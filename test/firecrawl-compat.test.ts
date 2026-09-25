import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FirecrawlV2Compat } from '../src/firecrawl-compat.js';

describe('Firecrawl v2 compatibility facade', () => {
  const resolvePublicTestHost = async () => ['93.184.216.34'];

  const pages = new Map<string, string>([
    ['https://example.com/', '<html><head><title>Example Home</title><meta name="description" content="Home description"></head><body><main><h1>Home</h1><a href="/docs">Docs</a><a href="https://api.example.com/reference">API Reference</a></main></body></html>'],
    ['https://example.com/docs', '<html><head><title>Docs</title></head><body><main><h1>Docs</h1><a href="/docs/a">A</a><a href="/pricing">Pricing</a></main></body></html>'],
    ['https://example.com/docs/a', '<html><head><title>Doc A</title></head><body><main><p>Child documentation page.</p></main></body></html>'],
    ['https://example.com/pricing', '<html><head><title>Pricing</title></head><body><main><p>Pricing page.</p></main></body></html>'],
    ['https://api.example.com/reference', '<html><head><title>API Reference</title></head><body><main><p>Subdomain reference.</p></main></body></html>']
  ]);

  const mockFetch: typeof globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const body = pages.get(input.toString());
    if (body === undefined) return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  };

  function compat(maxPages = 10): FirecrawlV2Compat {
    return new FirecrawlV2Compat({
      maxPages, maxConcurrency: 1, delayMs: 0, respectRobots: false, cache: false,
      fetch: mockFetch, resolveHostname: resolvePublicTestHost
    });
  }

  it('returns Firecrawl-shaped scrape output without provider credits', async () => {
    const result = await compat().scrape({ url: 'https://example.com/', formats: ['markdown', 'html', 'links'] });
    assert.equal(result.success, true);
    assert.equal(result.data.metadata.provider, 'nymrel-crawler-mesh');
    assert.equal(result.data.metadata.creditsUsed, 0);
    assert.equal(result.data.metadata.title, 'Example Home');
    assert.match(result.data.markdown ?? '', /Home/);
    assert.match(result.data.html ?? '', /Example Home/);
    assert.deepEqual(result.data.links?.sort(), ['https://api.example.com/reference', 'https://example.com/docs'].sort());
  });

  it('fails closed for unsupported Firecrawl formats', async () => {
    await assert.rejects(
      () => compat().scrape({ url: 'https://example.com/', formats: [{ type: 'json' }] }),
      /Unsupported Firecrawl v2 format: json/
    );
  });

  it('keeps nested crawls inside the child path by default', async () => {
    const result = await compat().crawl({ url: 'https://example.com/docs', limit: 10, maxDiscoveryDepth: 2 });
    assert.equal(result.creditsUsed, 0);
    assert.deepEqual(result.data.map(page => page.metadata.sourceURL).sort(), [
      'https://example.com/docs', 'https://example.com/docs/a'
    ]);
  });

  it('widens a crawl to the whole same domain explicitly', async () => {
    const result = await compat().crawl({
      url: 'https://example.com/docs', limit: 10, maxDiscoveryDepth: 1, crawlEntireDomain: true
    });
    assert.deepEqual(result.data.map(page => page.metadata.sourceURL).sort(), [
      'https://example.com/docs', 'https://example.com/docs/a', 'https://example.com/pricing'
    ]);
  });

  it('follows subdomains only when explicitly enabled', async () => {
    const result = await compat().crawl({
      url: 'https://example.com/', limit: 10, maxDiscoveryDepth: 1,
      crawlEntireDomain: true, allowSubdomains: true
    });
    assert.deepEqual(result.data.map(page => page.metadata.sourceURL).sort(), [
      'https://api.example.com/reference', 'https://example.com/', 'https://example.com/docs'
    ]);
  });

  it('maps discovered URLs with search filtering', async () => {
    const result = await compat().map({ url: 'https://example.com/', limit: 10, search: 'api', sitemap: 'skip' });
    assert.deepEqual(result.links.map(link => link.url), ['https://api.example.com/reference']);
  });

  it('rejects external crawling until one-hop parity is implemented', async () => {
    await assert.rejects(
      () => compat().crawl({ url: 'https://example.com/', allowExternalLinks: true }),
      /allowExternalLinks is not yet supported/
    );
  });
});
