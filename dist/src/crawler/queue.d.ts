/**
 * @nymrel/crawler-mesh
 * Deduplicated Priority & FIFO Crawl Queue
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import type { QueueItem } from './types.js';
export declare function isUrlAllowed(urlStr: string, startDomains: string[], mode?: 'same-domain' | 'subdomains' | 'any', allowedDomains?: string[], deniedPatterns?: (string | RegExp)[]): boolean;
export declare class CrawlQueue {
    private queue;
    private visitedUrls;
    private enqueuedUrls;
    private startDomains;
    private domainMatchMode;
    private allowedDomains;
    private deniedPatterns;
    private maxDepth;
    constructor(options?: {
        startDomains?: string[];
        domainMatchMode?: 'same-domain' | 'subdomains' | 'any';
        allowedDomains?: string[];
        deniedPatterns?: (string | RegExp)[];
        maxDepth?: number;
    });
    setStartDomains(domains: string[]): void;
    enqueue(item: QueueItem): boolean;
    dequeue(): QueueItem | undefined;
    markVisited(url: string): void;
    hasVisited(url: string): boolean;
    isEmpty(): boolean;
    size(): number;
    visitedCount(): number;
    clear(): void;
}
//# sourceMappingURL=queue.d.ts.map