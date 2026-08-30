/**
 * @nymrel/crawler-mesh
 * High-Performance XML Sitemap & Sitemap Index Parser
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import type { SitemapResult } from './types.js';
import { type NetworkPolicyOptions } from './network-policy.js';
export declare function parseSitemapXml(xmlContent: string): SitemapResult;
export interface SitemapFetchOptions extends NetworkPolicyOptions {
    userAgent?: string;
    timeoutMs?: number;
    maxDepth?: number;
    maxSitemaps?: number;
    maxUrls?: number;
    fetch?: typeof globalThis.fetch;
}
export declare function fetchAndParseSitemap(sitemapUrl: string, options?: SitemapFetchOptions): Promise<SitemapResult>;
//# sourceMappingURL=sitemap.d.ts.map