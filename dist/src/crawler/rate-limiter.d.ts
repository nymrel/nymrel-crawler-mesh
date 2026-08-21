/**
 * @nymrel/crawler-mesh
 * Polite Domain-Aware Rate Limiter & Concurrency Controller
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
export declare function extractDomain(urlStr: string): string;
export declare class PoliteRateLimiter {
    private defaultDelayMs;
    private maxConcurrencyPerDomain;
    private domainStates;
    constructor(options?: {
        defaultDelayMs?: number;
        maxConcurrencyPerDomain?: number;
    });
    private getOrCreateState;
    setDomainDelay(domain: string, delayMs: number): void;
    acquire(url: string): Promise<void>;
    release(url: string, statusCode?: number, retryAfterSec?: number): void;
    reset(): void;
}
//# sourceMappingURL=rate-limiter.d.ts.map