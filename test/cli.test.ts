/**
 * @nymrel/crawler-mesh
 * CLI Driver Test Suite
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runCli } from '../src/cli.js';

describe('CLI Driver Interface', () => {
  it('executes help and version commands successfully', async () => {
    const helpCode = await runCli(['--help']);
    assert.equal(helpCode, 0);

    const versionCode = await runCli(['--version']);
    assert.equal(versionCode, 0);
  });

  it('extracts clean markdown from local HTML file to output file', async () => {
    const tempHtml = path.resolve('.temp-test-page.html');
    const tempMd = path.resolve('.temp-test-output.md');

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

    // Cleanup
    await Promise.allSettled([
      fs.unlink(tempHtml),
      fs.unlink(tempMd)
    ]);
  });
});
