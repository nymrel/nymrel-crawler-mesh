import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FirecrawlV2Compat } from '../src/firecrawl-compat.js';

function client(rootStatus: number) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    if (new URL(url).pathname !== '/') return new Response('child failed', { status: 503 });
    return new Response('<html><body><main><h1>Root</h1><a href="/child">Child</a></main></body></html>', {
      status: rootStatus, headers: { 'content-type': 'text/html' }
    });
  };
  return { calls, crawler: new FirecrawlV2Compat({ fetch: fetcher, cache: false,
    respectRobots: false, maxPages: 3, maxConcurrency: 1, delayMs: 0,
    resolveHostname: async () => ['93.184.216.34'] }) };
}

for (const status of [403, 503]) {
  test(`map refuses failed HTTP ${status} root, even with a search filter`, async () => {
    const { crawler } = client(status);
    await assert.rejects(crawler.map({ url: 'https://example.com/', sitemap: 'skip', search: 'missing' }), /CRAWL_ROOT_NOT_ACQUIRED/);
  });
  test(`crawl refuses failed HTTP ${status} root`, async () => {
    const { crawler } = client(status);
    await assert.rejects(crawler.crawl({ url: 'https://example.com/', sitemap: 'skip' }), /CRAWL_ROOT_NOT_ACQUIRED/);
  });
}

test('successful root with no matching map results remains valid', async () => {
  const { crawler } = client(200);
  const result = await crawler.map({ url: 'https://example.com/', sitemap: 'skip', search: 'not-present' });
  assert.equal(result.success, true);
  assert.deepEqual(result.links, []);
});

test('failed descendant does not erase successful root and respects budget', async () => {
  const { crawler, calls } = client(200);
  const result = await crawler.crawl({ url: 'https://example.com/', sitemap: 'skip', limit: 2 });
  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]?.metadata.sourceURL, 'https://example.com/');
  assert.equal(calls.length, 2);
});
