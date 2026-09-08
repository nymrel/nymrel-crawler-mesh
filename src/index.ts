/**
 * @nymrel/crawler-mesh
 * Zero-Telemetry High-Throughput Web Crawler & Markdown/JSON Extractor for AI Agents
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { CrawlerMesh } from './crawler/mesh.js';
import { extractMarkdown } from './extractor/index.js';
import { parseSitemapXml, fetchAndParseSitemap } from './crawler/sitemap.js';
import type {
  CrawlOptions,
  CrawlResult,
  ExtractionResult,
  ExtractorOptions,
  SingleCrawlOptions,
  SitemapResult
} from './types.js';

// Re-export all subsystems and types
export * from './types.js';
export * from './cache/index.js';
export * from './cache/types.js';
export * from './extractor/index.js';
export * from './crawler/index.js';
export * from './radar-heal/index.js';

/**
 * Convenient standalone single URL crawler with Markdown extraction
 */
export async function crawlUrl(
  url: string,
  options: SingleCrawlOptions = {}
): Promise<CrawlResult> {
  const mesh = new CrawlerMesh({
    cache: options.cache,
    cacheDir: options.cacheDir,
    cacheTtl: options.cacheTtl,
    timeoutMs: options.timeoutMs,
    userAgent: options.userAgent,
    respectRobots: options.respectRobots,
    headers: options.headers,
    extractorOptions: options.extractorOptions,
    fetch: options.fetch,
    allowPrivateNetworks: options.allowPrivateNetworks,
    maxResponseBytes: options.maxResponseBytes,
    maxRedirects: options.maxRedirects,
    resolveHostname: options.resolveHostname
  });
  return mesh.crawlUrl(url, options);
}

/**
 * Convenient standalone sitemap parser for XML strings
 */
export function parseSitemap(xml: string): SitemapResult {
  return parseSitemapXml(xml);
}

// Default export
export default CrawlerMesh;
