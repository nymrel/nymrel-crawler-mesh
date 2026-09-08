import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHealCommand,
  digestJson,
  evaluateSnapshot,
  type ScrapeContract
} from '../src/radar-heal/index.js';

const contract: ScrapeContract = {
  schema: 'nymrel.radar-heal.contract.v1',
  name: 'public release feed',
  minRecords: 1,
  fields: [
    { path: 'title', required: true, type: 'string' },
    { path: 'url', required: true, type: 'string' },
    { path: 'publishedAt', required: true, type: 'string' },
    { path: 'tags', type: 'array' }
  ]
};

test('valid structured output passes without a heal prompt', () => {
  const report = evaluateSnapshot(contract, [
    {
      title: 'Release 1.2.3',
      url: 'https://example.com/releases/1.2.3',
      publishedAt: '2026-08-21T00:00:00Z',
      tags: ['release']
    }
  ]);
  assert.equal(report.status, 'pass');
  assert.equal(report.healPrompt, null);
  assert.equal(report.summary.issueCount, 0);
  assert.equal(report.claims.rawValuesIncluded, false);
});

test('missing and mistyped fields produce a bounded redacted drift report', () => {
  const report = evaluateSnapshot(contract, [
    {
      title: '',
      url: 42,
      tags: 'release'
    }
  ]);
  assert.equal(report.status, 'drift');
  assert.deepEqual(report.summary.affectedPaths, ['publishedAt', 'tags', 'title', 'url']);
  assert.match(report.healPrompt ?? '', /publishedAt/);
  assert.match(report.healPrompt ?? '', /Preserve the existing collector id/);
  assert.doesNotMatch(JSON.stringify(report), /Release 1\.2\.3/);
  assert.equal(report.claims.scraperHealed, false);
});

test('baseline presence collapse is detected without exposing raw values', () => {
  const baseline = [
    { title: 'A', url: 'https://example.com/a', publishedAt: '2026-08-20', tags: [] },
    { title: 'B', url: 'https://example.com/b', publishedAt: '2026-08-20', tags: [] }
  ];
  const current = [
    { title: 'A', url: 'https://example.com/a', publishedAt: '2026-08-21', tags: [] },
    { title: 'B', publishedAt: '2026-08-21', tags: [] }
  ];
  const report = evaluateSnapshot(contract, current, baseline);
  assert.equal(report.status, 'drift');
  assert.ok(report.issues.some((issue) => issue.code === 'missing_required'));
  assert.ok(report.issues.some((issue) => issue.code === 'baseline_presence_drop'));
});

test('canonical digest ignores object key order', () => {
  assert.equal(
    digestJson({ b: 2, a: { d: 4, c: 3 } }),
    digestJson({ a: { c: 3, d: 4 }, b: 2 })
  );
});

test('Bright Data heal command is pinned, shell-free, and never auto-approved', () => {
  const command = buildHealCommand(
    'c_example123',
    'The price field is missing. Restore price as a string.',
    'https://example.com/products/1'
  );
  assert.equal(command.autoApprove, false);
  assert.ok(command.args.includes('@brightdata/cli@0.3.2'));
  assert.ok(command.args.includes('heal'));
  assert.ok(!command.args.includes('--auto-approve'));
  assert.ok(!command.args.includes('approve'));
});

test('duplicate field paths fail closed', () => {
  const invalid: ScrapeContract = {
    ...contract,
    fields: [
      { path: 'title', required: true, type: 'string' },
      { path: 'title', required: true, type: 'string' }
    ]
  };
  assert.throws(() => evaluateSnapshot(invalid, []), /duplicate contract field path/);
});

// These checks stop before DNS, subprocesses, or provider calls.
test('rejects unsafe heal URLs and option-shaped prompts', () => {
  for (const target of ['https://[::1]/', 'https://127.1/', 'https://user:pass@example.com/', 'http://example.com/', 'https://example.com:444/']) {
    assert.throws(() => buildHealCommand('c_example123', 'Repair required title field.', target));
  }
  assert.throws(() => buildHealCommand('c_example123', '--auto-approve', 'https://example.com/'));
});

test('rejects arbitrary executable or injected arguments before execution', async () => {
  const { runHealProposal } = await import('../src/radar-heal/brightdata.js');
  const command = buildHealCommand('c_example123', 'Repair required title field.', 'https://example.com/');
  await assert.rejects(() => runHealProposal({ ...command, executable: 'malicious' }), /pinned/);
  await assert.rejects(() => runHealProposal({ ...command, args: [...command.args, '--auto-approve'] }), /shape/);
  await assert.rejects(() => runHealProposal(command, -1), /timeout/);
});
