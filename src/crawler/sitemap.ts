/**
 * @nymrel/crawler-mesh
 * High-Performance XML Sitemap & Sitemap Index Parser
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import type { SitemapEntry, SitemapResult } from './types.js';

export function parseSitemapXml(xmlContent: string): SitemapResult {
  const result: SitemapResult = {
    urls: [],
    sitemaps: [],
    errors: []
  };

  // 1. Check for sitemap index (<sitemapindex>)
  if (/<sitemapindex\b/i.test(xmlContent)) {
    const sitemapBlocks = xmlContent.match(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi) || [];
    for (const block of sitemapBlocks) {
      const locMatch = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i);
      if (locMatch) {
        const loc = locMatch[1].trim();
        if (loc && !result.sitemaps.includes(loc)) {
          result.sitemaps.push(loc);
        }
      }
    }
  }

  // 2. Check for urlset (<urlset>)
  const urlBlocks = xmlContent.match(/<url\b[^>]*>([\s\S]*?)<\/url>/gi) || [];
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i);
    if (!locMatch) continue;

    const loc = locMatch[1].trim();
    if (!loc) continue;

    const lastmodMatch = block.match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i);
    const changefreqMatch = block.match(/<changefreq\b[^>]*>([\s\S]*?)<\/changefreq>/i);
    const priorityMatch = block.match(/<priority\b[^>]*>([\s\S]*?)<\/priority>/i);

    const entry: SitemapEntry = {
      loc,
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : undefined,
      changefreq: changefreqMatch ? changefreqMatch[1].trim() : undefined,
      priority: priorityMatch ? parseFloat(priorityMatch[1].trim()) : undefined
    };

    result.urls.push(entry);
  }

  return result;
}

export async function fetchAndParseSitemap(
  sitemapUrl: string,
  options: {
    userAgent?: string;
    timeoutMs?: number;
    maxDepth?: number;
    currentDepth?: number;
    fetch?: typeof globalThis.fetch;
  } = {}
): Promise<SitemapResult> {
  const fetchFn = options.fetch || globalThis.fetch;
  const maxDepth = options.maxDepth ?? 2;
  const currentDepth = options.currentDepth ?? 0;

  const combinedResult: SitemapResult = {
    urls: [],
    sitemaps: [],
    errors: []
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

    const response = await fetchFn(sitemapUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': options.userAgent || 'NymrelCrawlerMesh/1.0 (+https://github.com/nymrel/nymrel-crawler-mesh)',
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      combinedResult.errors.push(`HTTP ${response.status} fetching sitemap ${sitemapUrl}`);
      return combinedResult;
    }

    const xml = await response.text();
    const parsed = parseSitemapXml(xml);

    combinedResult.urls.push(...parsed.urls);
    combinedResult.sitemaps.push(...parsed.sitemaps);

    // Recursively parse child sitemaps if under maxDepth
    if (parsed.sitemaps.length > 0 && currentDepth < maxDepth) {
      for (const childSitemap of parsed.sitemaps) {
        try {
          const childResult = await fetchAndParseSitemap(childSitemap, {
            ...options,
            currentDepth: currentDepth + 1
          });
          combinedResult.urls.push(...childResult.urls);
          combinedResult.errors.push(...childResult.errors);
        } catch (err: any) {
          combinedResult.errors.push(`Error fetching child sitemap ${childSitemap}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    combinedResult.errors.push(`Failed to fetch sitemap ${sitemapUrl}: ${err.message}`);
  }

  return combinedResult;
}
