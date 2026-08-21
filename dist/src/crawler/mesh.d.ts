/**
 * @nymrel/crawler-mesh
 * Core High-Throughput Crawler Engine
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import { EventEmitter } from 'node:events';
import type { BenchmarkResult, CrawlOptions, CrawlResult, CrawlSummary, SingleCrawlOptions } from '../types.js';
export declare class CrawlerMesh extends EventEmitter {
    private config;
    private cache;
    private rateLimiter;
    private robotsCache;
    constructor(options?: CrawlOptions);
    private getRobotsParser;
    crawlUrl(rawUrl: string, options?: SingleCrawlOptions): Promise<CrawlResult>;
    crawl(startUrl: string | string[], options?: Partial<CrawlOptions>): Promise<CrawlSummary>;
    crawlStream(startUrl: string | string[], options?: Partial<CrawlOptions>): AsyncIterable<CrawlResult>;
    benchmark(targetUrl: string, count?: number, concurrency?: number): Promise<BenchmarkResult>;
    clearCache(): Promise<void>;
}
//# sourceMappingURL=mesh.d.ts.map