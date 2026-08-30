/**
 * Outbound HTTP policy shared by the crawler, sitemap reader, and CLI.
 * The default is intentionally fail closed for local and non-global targets.
 */
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
export class CrawlerSecurityError extends Error {
    code;
    constructor(code) {
        super(`Crawler request rejected: ${code}`);
        this.name = 'CrawlerSecurityError';
        this.code = code;
    }
}
export const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_REDIRECTS = 5;
const NON_GLOBAL = new BlockList();
for (const [address, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
]) {
    NON_GLOBAL.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['2001::', 23],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['3fff::', 20],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8]
]) {
    NON_GLOBAL.addSubnet(address, prefix, 'ipv6');
}
function hostnameWithoutBrackets(hostname) {
    return hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname;
}
function isNonGlobalAddress(address) {
    const family = isIP(address);
    if (family === 4)
        return NON_GLOBAL.check(address, 'ipv4');
    if (family === 6)
        return NON_GLOBAL.check(address, 'ipv6');
    return true;
}
async function defaultResolver(hostname) {
    const literalFamily = isIP(hostname);
    if (literalFamily !== 0)
        return [hostname];
    const records = await lookup(hostname, { all: true, order: 'verbatim' });
    return records.map(record => record.address);
}
function normalizedPositiveInteger(value, fallback) {
    if (value === undefined)
        return fallback;
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError('Network limits must be positive safe integers');
    }
    return value;
}
export async function assertSafeHttpUrl(input, options = {}) {
    let url;
    try {
        url = input instanceof URL ? new URL(input) : new URL(input);
    }
    catch {
        throw new CrawlerSecurityError('INVALID_URL');
    }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
        throw new CrawlerSecurityError('INVALID_URL');
    }
    if (url.username || url.password) {
        throw new CrawlerSecurityError('UNSAFE_URL_CREDENTIALS');
    }
    if (options.allowPrivateNetworks)
        return url;
    const hostname = hostnameWithoutBrackets(url.hostname);
    let addresses;
    try {
        addresses = isIP(hostname) !== 0
            ? [hostname]
            : await (options.resolveHostname ?? defaultResolver)(hostname);
    }
    catch {
        throw new CrawlerSecurityError('DNS_RESOLUTION_FAILED');
    }
    if (addresses.length === 0 || addresses.some(isNonGlobalAddress)) {
        throw new CrawlerSecurityError('PRIVATE_NETWORK_TARGET');
    }
    return url;
}
function isRedirect(status) {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
function stripSensitiveHeadersOnCrossOrigin(headers, from, to) {
    if (from.origin === to.origin)
        return;
    headers.delete('authorization');
    headers.delete('cookie');
    headers.delete('proxy-authorization');
}
export async function fetchWithPolicy(input, init = {}, options = {}) {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const maxRedirects = normalizedPositiveInteger(options.maxRedirects, DEFAULT_MAX_REDIRECTS);
    const timeoutMs = normalizedPositiveInteger(options.timeoutMs, 15_000);
    let currentUrl = await assertSafeHttpUrl(input, options);
    let method = init.method ?? 'GET';
    let body = init.body;
    const headers = new Headers(init.headers);
    for (let redirects = 0;; redirects += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const signal = init.signal
            ? AbortSignal.any([init.signal, controller.signal])
            : controller.signal;
        let response;
        try {
            response = await fetchFn(currentUrl, {
                ...init,
                method,
                body,
                headers,
                redirect: 'manual',
                signal
            });
        }
        finally {
            clearTimeout(timeout);
        }
        if (!isRedirect(response.status)) {
            return { response, finalUrl: currentUrl.toString() };
        }
        const location = response.headers.get('location');
        if (!location)
            return { response, finalUrl: currentUrl.toString() };
        if (redirects >= maxRedirects) {
            await response.body?.cancel();
            throw new CrawlerSecurityError('TOO_MANY_REDIRECTS');
        }
        let nextUrl;
        try {
            nextUrl = new URL(location, currentUrl);
            nextUrl = await assertSafeHttpUrl(nextUrl, options);
        }
        catch (error) {
            if (error instanceof CrawlerSecurityError)
                throw error;
            throw new CrawlerSecurityError('INVALID_URL');
        }
        finally {
            await response.body?.cancel();
        }
        stripSensitiveHeadersOnCrossOrigin(headers, currentUrl, nextUrl);
        if (response.status === 303 || ((response.status === 301 || response.status === 302) && method.toUpperCase() === 'POST')) {
            method = 'GET';
            body = undefined;
            headers.delete('content-length');
            headers.delete('content-type');
        }
        currentUrl = nextUrl;
    }
}
export async function readResponseText(response, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES) {
    const maxBytes = normalizedPositiveInteger(maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES);
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) {
        const parsedLength = Number(declaredLength);
        if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
            await response.body?.cancel();
            throw new CrawlerSecurityError('RESPONSE_TOO_LARGE');
        }
    }
    if (!response.body)
        return '';
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            if (!value)
                continue;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                throw new CrawlerSecurityError('RESPONSE_TOO_LARGE');
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
}
//# sourceMappingURL=network-policy.js.map