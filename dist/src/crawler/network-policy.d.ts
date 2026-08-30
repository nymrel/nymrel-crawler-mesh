/**
 * Outbound HTTP policy shared by the crawler, sitemap reader, and CLI.
 * The default is intentionally fail closed for local and non-global targets.
 */
export type CrawlerSecurityErrorCode = 'INVALID_URL' | 'UNSAFE_URL_CREDENTIALS' | 'PRIVATE_NETWORK_TARGET' | 'DNS_RESOLUTION_FAILED' | 'TOO_MANY_REDIRECTS' | 'RESPONSE_TOO_LARGE';
export declare class CrawlerSecurityError extends Error {
    readonly code: CrawlerSecurityErrorCode;
    constructor(code: CrawlerSecurityErrorCode);
}
export interface NetworkPolicyOptions {
    /** Allow loopback, private, link-local, and other non-global targets. Default: false. */
    allowPrivateNetworks?: boolean;
    /** Maximum decoded response body in bytes. Default: 10 MiB. */
    maxResponseBytes?: number;
    /** Maximum number of followed redirects. Default: 5. */
    maxRedirects?: number;
    /** Resolver override for deterministic tests and controlled runtimes. */
    resolveHostname?: (hostname: string) => Promise<string[]>;
}
export interface SafeFetchOptions extends NetworkPolicyOptions {
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
}
export interface SafeFetchResult {
    response: Response;
    finalUrl: string;
}
export declare const DEFAULT_MAX_RESPONSE_BYTES: number;
export declare const DEFAULT_MAX_REDIRECTS = 5;
export declare function assertSafeHttpUrl(input: string | URL, options?: NetworkPolicyOptions): Promise<URL>;
export declare function fetchWithPolicy(input: string | URL, init?: RequestInit, options?: SafeFetchOptions): Promise<SafeFetchResult>;
export declare function readResponseText(response: Response, maxResponseBytes?: number): Promise<string>;
//# sourceMappingURL=network-policy.d.ts.map