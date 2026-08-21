/**
 * @nymrel/crawler-mesh
 * PoliteRateLimiter Test Suite
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PoliteRateLimiter, extractDomain } from '../src/crawler/rate-limiter.js';

describe('Polite Domain Rate Limiter', () => {
  it('extracts lowercase domain correctly', () => {
    assert.equal(extractDomain('https://API.Example.com/v1/data'), 'api.example.com');
    assert.equal(extractDomain('http://localhost:8080/test'), 'localhost');
  });

  it('enforces delay between requests to the same domain', async () => {
    const limiter = new PoliteRateLimiter({ defaultDelayMs: 60, maxConcurrencyPerDomain: 1 });
    const url = 'https://example.com/page1';

    const t0 = Date.now();
    await limiter.acquire(url);
    limiter.release(url, 200);

    await limiter.acquire(url);
    limiter.release(url, 200);
    const elapsed = Date.now() - t0;

    assert.ok(elapsed >= 50, `Elapsed time (${elapsed}ms) should be at least 50ms`);
  });

  it('triggers backoff upon encountering HTTP 429', async () => {
    const limiter = new PoliteRateLimiter({ defaultDelayMs: 10 });
    const url = 'https://rate-limited.com/api';

    await limiter.acquire(url);
    // Tell limiter we received 429 with 0.1s retry-after
    limiter.release(url, 429, 0.1);

    const t0 = Date.now();
    await limiter.acquire(url);
    limiter.release(url, 200);
    const elapsed = Date.now() - t0;

    assert.ok(elapsed >= 90, `Backoff delay (${elapsed}ms) should be at least 90ms`);
  });
});
