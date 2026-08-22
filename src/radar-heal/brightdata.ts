import { spawn } from 'node:child_process';

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
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('target URL must use http or https');
  }
  url.username = '';
  url.password = '';
  return url.toString();
}

export function buildHealCommand(
  collectorId: string,
  prompt: string,
  targetUrl: string
): HealCommand {
  const collector = validateIdentifier(collectorId, 'collector id');
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt || normalizedPrompt.length > 1000) {
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
  if (command.autoApprove) {
    throw new Error('RadarHeal never executes auto-approved scraper changes');
  }
  if (command.args.includes('--auto-approve') || command.args.includes('approve')) {
    throw new Error('RadarHeal proposal command must stop at Bright Data approval');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      try {
        stdout = appendBounded(stdout, chunk, MAX_OUTPUT_BYTES);
      } catch (error) {
        child.kill('SIGTERM');
        reject(error);
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      try {
        stderr = appendBounded(stderr, chunk, MAX_OUTPUT_BYTES);
      } catch (error) {
        child.kill('SIGTERM');
        reject(error);
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut
      });
    });
  });
}
