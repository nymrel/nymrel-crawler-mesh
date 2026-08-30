/**
 * @nymrel/crawler-mesh
 * RobotsParser Test Suite
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RobotsParser } from '../src/crawler/robots.js';

describe('Robots.txt path matcher', () => {
  const robotsTxt = `
    User-agent: *
    Disallow: /admin/
    Disallow: /private/
    Allow: /private/public-doc.html
    Disallow: /*.pdf$
    Crawl-delay: 2.5
    Sitemap: https://example.com/sitemap.xml
    Sitemap: https://example.com/sitemap-news.xml

    User-agent: GPTBot
    Disallow: /no-ai/
    Allow: /

    User-agent: NymrelCrawlerMesh
    Allow: /
    Disallow: /very-secret/
    Crawl-delay: 0.5
  `;

  const parser = new RobotsParser(robotsTxt);

  it('correctly handles wildcard user agent rules', () => {
    assert.equal(parser.isAllowed('https://example.com/blog/post-1', '*'), true);
    assert.equal(parser.isAllowed('https://example.com/admin/settings', '*'), false);
    assert.equal(parser.isAllowed('https://example.com/private/secret.html', '*'), false);
    // Specificity test: Allow on longer path should win
    assert.equal(parser.isAllowed('https://example.com/private/public-doc.html', '*'), true);
    // End anchor $ test
    assert.equal(parser.isAllowed('https://example.com/docs/manual.pdf', '*'), false);
    assert.equal(parser.isAllowed('https://example.com/docs/manual.pdf.html', '*'), true);
  });

  it('matches specific user agent groups with precedence', () => {
    assert.equal(parser.isAllowed('https://example.com/no-ai/doc', 'GPTBot/1.0'), false);
    assert.equal(parser.isAllowed('https://example.com/admin/settings', 'GPTBot/1.0'), true);

    assert.equal(parser.isAllowed('https://example.com/very-secret/keys', 'NymrelCrawlerMesh/1.0'), false);
    assert.equal(parser.isAllowed('https://example.com/admin/settings', 'NymrelCrawlerMesh/1.0'), true);
  });

  it('extracts crawl delay per user agent', () => {
    assert.equal(parser.getCrawlDelay('*'), 2.5);
    assert.equal(parser.getCrawlDelay('NymrelCrawlerMesh/1.0'), 0.5);
  });

  it('extracts all listed sitemaps', () => {
    const sitemaps = parser.getSitemaps();
    assert.equal(sitemaps.length, 2);
    assert.ok(sitemaps.includes('https://example.com/sitemap.xml'));
    assert.ok(sitemaps.includes('https://example.com/sitemap-news.xml'));
  });
});
