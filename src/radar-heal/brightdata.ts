import { spawn } from 'node:child_process';
import { isIP } from 'node:net';

import { assertSafeHttpUrl } from '../crawler/network-policy.js';

import type { HealCommand, HealProposalResult } from './types.js';

const CLI_VERSION = '0.3.2';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

function validateIdentifier(value: string, label: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(trimmed)) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return trimmed;
}

function validateUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port) {
    throw new Error('target URL must use standard HTTPS');
  }
  if (url.username || url.password) throw new Error('target URL must not contain credentials');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (isIP(hostname.replace(/^\[|\]$/g, '')) || !hostname.includes('.')
    || /\.(?:localhost|local|internal|gov|mil)$/.test(hostname)) {
    throw new Error('target must be a reviewed public hostname');
  }
  return url.toString();
}

export function validateHealCommand(command: HealCommand): HealCommand {
  if (!command || !Array.isArray(command.args) || command.args.length !== 11
    || command.args.some((arg) => typeof arg !== 'string')) throw new Error('invalid heal command shape');
  const expected = buildHealCommand(command.args[6], command.args[7], command.args[9]);
  if (command.executable !== expected.executable || command.autoApprove !== false
    || command.mutatesRemoteScraper !== true
    || JSON.stringify(command.args) !== JSON.stringify(expected.args)) {
    throw new Error('heal command must match the pinned proposal invocation');
  }
  return expected;
}

export function buildHealCommand(
  collectorId: string,
  prompt: string,
  targetUrl: string
): HealCommand {
  const collector = validateIdentifier(collectorId, 'collector id');
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt || normalizedPrompt.length > 1000 || normalizedPrompt.startsWith('-')
    || /[\u0000-\u001f\u007f]/.test(normalizedPrompt)) {
    throw new Error('heal prompt must contain 1–1000 characters');
  }
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return {
    executable,
    args: [
      '--yes',
      '--package',
      `@brightdata/cli@${CLI_VERSION}`,
      'brightdata',
      'scraper',
      'heal',
      collector,
      normalizedPrompt,
      '--url',
      validateUrl(targetUrl),
      '--pretty'
    ],
    mutatesRemoteScraper: true,
    autoApprove: false
  };
}

function appendBounded(current: string, chunk: Buffer, maximum: number): string {
  const next = current + chunk.toString('utf8');
  if (Buffer.byteLength(next, 'utf8') > maximum) {
    throw new Error('Bright Data CLI output exceeded the configured limit');
  }
  return next;
}

export async function runHealProposal(
  command: HealCommand,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<HealProposalResult> {
  const checked = validateHealCommand(command);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > DEFAULT_TIMEOUT_MS) throw new Error('invalid proposal timeout');
  const target = new URL(checked.args[9]);
  const trustedOrigins = (process.env.RADAR_HEAL_TRUSTED_ORIGINS ?? '').split(',').map((origin) => origin.trim());
  if (!trustedOrigins.includes(target.origin)) throw new Error('proposal execution requires an exact operator-trusted target origin');
  if (process.platform === 'win32') throw new Error('proposal execution requires a POSIX process-group runtime; Windows supports plan generation');
  await assertSafeHttpUrl(target);

  return new Promise((resolve, reject) => {
    const child = spawn(checked.executable, checked.args, {
      env: process.env,
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const stop = (): void => {
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      try {
        stdout = appendBounded(stdout, chunk, MAX_OUTPUT_BYTES);
      } catch (error) {
        clearTimeout(timer);
        stop();
        reject(error);
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      try {
        stderr = appendBounded(stderr, chunk, MAX_OUTPUT_BYTES);
      } catch (error) {
        clearTimeout(timer);
        stop();
        reject(error);
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      stop();
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut
      });
    });
  });
}
