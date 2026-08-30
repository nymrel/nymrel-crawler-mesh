/**
 * @nymrel/crawler-mesh
 * CrawlerMesh Engine & Integration Test Suite
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CrawlerMesh } from '../src/crawler/mesh.js';
import { parseSitemapXml } from '../src/crawler/sitemap.js';

describe('CrawlerMesh Core Engine', () => {
  const resolvePublicTestHost = async () => ['93.184.216.34'];
  // Mock fetch handler
  const mockFetch: typeof globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = input.toString();

    if (urlStr.endsWith('/robots.txt')) {
      const robots = `
        User-agent: *
        Disallow: /forbidden/
        Allow: /
      `;
      return new Response(robots, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    if (urlStr === 'https://example.com' || urlStr === 'https://example.com/') {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Example Domain</title></head>
          <body>
            <main>
              <h1>Example Domain</h1>
              <p>This is the main portal page.</p>
              <a href="https://example.com/docs">Documentation</a>
              <a href="https://example.com/forbidden/secret">Secret Area</a>
            </main>
          </body>
        </html>
      `;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    if (urlStr === 'https://example.com/docs') {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Documentation</title></head>
          <body>
            <main>
              <h2>API Documentation</h2>
              <p>Details about the API endpoints.</p>
              <a href="https://example.com/docs/auth">Auth Guide</a>
            </main>
          </body>
        </html>
      `;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    if (urlStr === 'https://example.com/docs/auth') {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Auth Guide</title></head>
          <body>
            <main>
              <h3>Authentication</h3>
              <p>Use bearer tokens.</p>
            </main>
          </body>
        </html>
      `;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    return new Response('Not Found', { status: 404, statusText: 'Not Found' });
  };

  it('crawls a single URL and extracts clean markdown', async () => {
    const mesh = new CrawlerMesh({
      fetch: mockFetch,
      cache: false,
      delayMs: 0,
      resolveHostname: resolvePublicTestHost
    });

    const result = await mesh.crawlUrl('https://example.com');

    assert.equal(result.statusCode, 200);
    assert.equal(result.metadata.title, 'Example Domain');
    assert.ok(result.markdown.includes('# Example Domain'));
    assert.ok(result.markdown.includes('This is the main portal page.'));
    assert.equal(result.links.length, 2);
  });

  it('recursively crawls linked pages respecting maxDepth', async () => {
    const mesh = new CrawlerMesh({
      fetch: mockFetch,
      cache: false,
      maxDepth: 1,
      delayMs: 0,
      resolveHostname: resolvePublicTestHost
    });

    const summary = await mesh.crawl('https://example.com');

    assert.ok(summary.totalCrawled >= 2, `Should have crawled at least 2 pages (got ${summary.totalCrawled})`);
    const urls = summary.results.map(r => r.url);
    assert.ok(urls.includes('https://example.com'));
    assert.ok(urls.includes('https://example.com/docs'));
    // /forbidden/secret should be rejected by robots.txt
    assert.ok(!urls.includes('https://example.com/forbidden/secret'), 'Should not crawl robots-forbidden URL');
  });

  it('runs throughput benchmark calculation correctly', async () => {
    const mesh = new CrawlerMesh({
      fetch: mockFetch,
      delayMs: 0,
      resolveHostname: resolvePublicTestHost
    });

    const bench = await mesh.benchmark('https://example.com', 5, 2);

    assert.equal(bench.totalRequests, 5);
    assert.equal(bench.successfulRequests, 5);
    assert.ok(bench.requestsPerSecond > 0);
    assert.ok(bench.avgLatencyMs >= 0);
  });

  it('parses XML sitemaps with urlset and loc tags', () => {
    const sitemapXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/page1</loc>
          <lastmod>2026-08-20</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.8</priority>
        </url>
        <url>
          <loc>https://example.com/page2</loc>
          <lastmod>2026-08-21</lastmod>
        </url>
      </urlset>
    `;

    const parsed = parseSitemapXml(sitemapXml);
    assert.equal(parsed.urls.length, 2);
    assert.equal(parsed.urls[0].loc, 'https://example.com/page1');
    assert.equal(parsed.urls[0].lastmod, '2026-08-20');
    assert.equal(parsed.urls[0].priority, 0.8);
    assert.equal(parsed.urls[1].loc, 'https://example.com/page2');
  });
});
