/**
 * @nymrel/crawler-mesh
 * CLI Driver Test Suite
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCli } from '../src/cli.js';

describe('CLI Driver Interface', () => {
  it('extracts structured JSON from piped HTML using the documented stdin target', () => {
    const cli = new URL('../../bin/crawler-mesh.js', import.meta.url);
    const result = spawnSync(process.execPath, [cli.pathname, 'extract', '-', '--format', 'json'], {
      input: '<html><head><title>Piped example</title></head><body><h1>Saved page</h1><p>Offline content</p></body></html>',
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    const extracted = JSON.parse(result.stdout);
    assert.ok(extracted.markdown.includes('Saved page'));
    assert.ok(extracted.markdown.includes('Offline content'));
  });
  it('executes help and version commands successfully', async () => {
    const helpCode = await runCli(['--help']);
    assert.equal(helpCode, 0);

    const versionCode = await runCli(['--version']);
    assert.equal(versionCode, 0);
  });

  it('extracts clean markdown from local HTML file to output file', async () => {
    const tempDirectory = await fs.mkdtemp(path.join(tmpdir(), 'nymrel-crawler-cli-'));
    const tempHtml = path.join(tempDirectory, 'page.html');
    const tempMd = path.join(tempDirectory, 'output.md');

    try {
      await fs.writeFile(
        tempHtml,
        '<html><head><title>CLI Extract Test</title></head><body><main><h1>CLI Works</h1><p>Hello CLI</p></main></body></html>',
        'utf-8'
      );

      const code = await runCli(['extract', tempHtml, '--output', tempMd]);
      assert.equal(code, 0);

      const mdContent = await fs.readFile(tempMd, 'utf-8');
      assert.ok(mdContent.includes('# CLI Works'));
      assert.ok(mdContent.includes('Hello CLI'));
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
