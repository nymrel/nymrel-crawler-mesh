/**
 * @nymrel/crawler-mesh
 * ContentCache Test Suite
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ContentCache, computeSha256, normalizeUrlKey } from '../src/cache/index.js';

describe('SHA-256 Content Caching Layer', () => {
  const testCacheDir = path.resolve('.test-cache-dir');

  after(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('normalizes URLs by stripping tracking parameters and sorting query params', () => {
    const raw1 = 'https://Example.com/blog/article?utm_source=twitter&b=2&a=1#section2';
    const raw2 = 'https://example.com/blog/article?a=1&b=2&fbclid=12345';
    assert.equal(normalizeUrlKey(raw1), normalizeUrlKey(raw2));
  });

  it('computes deterministic SHA-256 hashes', () => {
    const hash1 = computeSha256('Hello Nymrel');
    const hash2 = computeSha256('Hello Nymrel');
    const hash3 = computeSha256('Different text');

    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hash3);
    assert.equal(hash1.length, 64);
  });

  it('stores and retrieves cached pages with metadata and headers', async () => {
    const cache = new ContentCache({
      cacheDir: testCacheDir,
      ttlSeconds: 3600
    });

    const url = 'https://nymrel.com/docs/intro';
    const sampleEntry = {
      url,
      statusCode: 200,
      statusText: 'OK',
      headers: { 'etag': '"xyz-123"', 'last-modified': 'Wed, 21 Oct 2025 07:28:00 GMT' },
      contentType: 'text/html',
      html: '<html><body><h1>Intro</h1></body></html>',
      markdown: '# Intro',
      text: 'Intro',
      metadata: {
        title: 'Intro',
        description: 'Intro document',
        openGraph: {},
        twitterCard: {},
        keywords: [],
        wordCount: 1,
        characterCount: 5,
        readingTimeMinutes: 1,
        estimatedTokens: 2
      },
      links: [],
      images: [],
      tables: [],
      codeBlocks: [],
      etag: '"xyz-123"',
      lastModified: 'Wed, 21 Oct 2025 07:28:00 GMT'
    };

    await cache.set(url, sampleEntry);

    const exists = await cache.has(url);
    assert.equal(exists, true);

    const retrieved = await cache.get(url);
    assert.ok(retrieved !== null);
    assert.equal(retrieved?.markdown, '# Intro');
    assert.equal(retrieved?.etag, '"xyz-123"');

    const condHeaders = cache.getConditionalHeaders(url);
    assert.equal(condHeaders['If-None-Match'], '"xyz-123"');
  });

  it('respects TTL and expires stale entries', async () => {
    const cache = new ContentCache({
      cacheDir: testCacheDir,
      ttlSeconds: 0 // Immediate expiration
    });

    const url = 'https://nymrel.com/transient';
    await cache.set(url, {
      url,
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'text/html',
      html: '<p>temp</p>',
      markdown: 'temp',
      text: 'temp',
      metadata: {
        title: 'Temp',
        description: '',
        openGraph: {},
        twitterCard: {},
        keywords: [],
        wordCount: 1,
        characterCount: 4,
        readingTimeMinutes: 1,
        estimatedTokens: 1
      },
      links: [],
      images: [],
      tables: [],
      codeBlocks: []
    });

    // Wait 10ms
    await new Promise(r => setTimeout(r, 10));

    const retrieved = await cache.get(url);
    assert.equal(retrieved, null, 'Expired entry should return null');
  });
});
