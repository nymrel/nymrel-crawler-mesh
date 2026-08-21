/**
 * @nymrel/crawler-mesh
 * Content-Hash SHA-256 Caching Layer
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import type { CacheDriver, CacheEntry, CacheOptions } from './types.js';
export declare function computeSha256(content: string | Buffer): string;
export declare function normalizeUrlKey(rawUrl: string): string;
export declare class ContentCache implements CacheDriver {
    private enabled;
    private cacheDir;
    private ttlSeconds;
    private inMemory;
    private memoryStore;
    private maxMemoryEntries;
    constructor(options?: CacheOptions);
    computeHash(content: string | Buffer): string;
    private getDiskPath;
    get(rawUrl: string): Promise<CacheEntry | null>;
    set(rawUrl: string, entry: Omit<CacheEntry, 'hash' | 'savedAt' | 'expiresAt'>): Promise<CacheEntry>;
    private setInMemory;
    has(rawUrl: string): Promise<boolean>;
    delete(rawUrl: string): Promise<boolean>;
    clear(): Promise<void>;
    getConditionalHeaders(rawUrl: string): Record<string, string>;
}
//# sourceMappingURL=index.d.ts.map