/**
 * @nymrel/crawler-mesh
 * High-Performance XML Sitemap & Sitemap Index Parser
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import type { SitemapResult } from './types.js';
export declare function parseSitemapXml(xmlContent: string): SitemapResult;
export declare function fetchAndParseSitemap(sitemapUrl: string, options?: {
    userAgent?: string;
    timeoutMs?: number;
    maxDepth?: number;
    currentDepth?: number;
    fetch?: typeof globalThis.fetch;
}): Promise<SitemapResult>;
//# sourceMappingURL=sitemap.d.ts.map