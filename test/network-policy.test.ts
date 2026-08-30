import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrawlerMesh } from '../src/crawler/mesh.js';
import {
  assertSafeHttpUrl,
  CrawlerSecurityError,
  fetchWithPolicy,
  readResponseText
} from '../src/crawler/network-policy.js';

const publicResolver = async () => ['93.184.216.34'];

async function expectSecurityCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof CrawlerSecurityError);
    assert.equal(error.code, code);
    return true;
  });
}

describe('Outbound crawler policy', () => {
  it('rejects non-HTTP URLs, embedded credentials, and private destinations', async () => {
    await expectSecurityCode(assertSafeHttpUrl('file:///etc/passwd'), 'INVALID_URL');
    await expectSecurityCode(
      assertSafeHttpUrl('https://user:secret@example.com', { resolveHostname: publicResolver }),
      'UNSAFE_URL_CREDENTIALS'
    );
    await expectSecurityCode(assertSafeHttpUrl('http://127.0.0.1/admin'), 'PRIVATE_NETWORK_TARGET');
    await expectSecurityCode(
      assertSafeHttpUrl('https://example.test', { resolveHostname: async () => ['10.1.2.3'] }),
      'PRIVATE_NETWORK_TARGET'
    );
  });

  it('allows explicit private-network opt in without weakening URL validation', async () => {
    const url = await assertSafeHttpUrl('http://127.0.0.1/health', {
      allowPrivateNetworks: true
    });
    assert.equal(url.hostname, '127.0.0.1');
    await expectSecurityCode(
      assertSafeHttpUrl('file:///tmp/data', { allowPrivateNetworks: true }),
      'INVALID_URL'
    );
  });

  it('validates redirect destinations before issuing the next request', async () => {
    let requests = 0;
    const redirectingFetch: typeof globalThis.fetch = async () => {
      requests += 1;
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/internal' }
      });
    };

    await expectSecurityCode(fetchWithPolicy('https://public.test', {}, {
      fetch: redirectingFetch,
      resolveHostname: publicResolver
    }), 'PRIVATE_NETWORK_TARGET');
    assert.equal(requests, 1, 'the private redirect target must never be requested');
  });

  it('caps streamed and declared response bodies', async () => {
    await expectSecurityCode(
      readResponseText(new Response('12345'), 4),
      'RESPONSE_TOO_LARGE'
    );
    await expectSecurityCode(
      readResponseText(new Response('x', { headers: { 'content-length': '100' } }), 4),
      'RESPONSE_TOO_LARGE'
    );
  });

  it('reserves page slots before concurrent work begins', async () => {
    const page = '<main><a href="https://public.test/a">a</a><a href="https://public.test/b">b</a><a href="https://public.test/c">c</a></main>';
    const fetchFn: typeof globalThis.fetch = async () => new Response(page, {
      status: 200,
      headers: { 'content-type': 'text/html' }
    });
    const mesh = new CrawlerMesh({
      fetch: fetchFn,
      resolveHostname: publicResolver,
      respectRobots: false,
      cache: false,
      delayMs: 0,
      maxConcurrency: 5,
      maxPages: 2,
      maxDepth: 1
    });

    const summary = await mesh.crawl('https://public.test');
    assert.equal(summary.totalCrawled, 2);
  });

  it('creates benchmark requests lazily within the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const fetchFn: typeof globalThis.fetch = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active -= 1;
      return new Response('<main>ok</main>', { status: 200 });
    };
    const mesh = new CrawlerMesh({
      fetch: fetchFn,
      resolveHostname: publicResolver,
      respectRobots: false,
      cache: false,
      delayMs: 0
    });

    const result = await mesh.benchmark('https://public.test', 8, 2);
    assert.equal(result.successfulRequests, 8);
    assert.equal(peak, 2);
  });
});
