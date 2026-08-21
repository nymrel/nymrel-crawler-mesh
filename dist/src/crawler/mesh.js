/**
 * @nymrel/crawler-mesh
 * Core High-Throughput Crawler Engine
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import { EventEmitter } from 'node:events';
import { ContentCache } from '../cache/index.js';
import { extractMarkdown } from '../extractor/index.js';
import { extractDomain, PoliteRateLimiter } from './rate-limiter.js';
import { CrawlQueue } from './queue.js';
import { RobotsParser } from './robots.js';
import { fetchAndParseSitemap } from './sitemap.js';
export class CrawlerMesh extends EventEmitter {
    config;
    cache;
    rateLimiter;
    robotsCache = new Map();
    constructor(options = {}) {
        super();
        this.config = {
            maxDepth: options.maxDepth ?? 2,
            maxPages: options.maxPages ?? 50,
            maxConcurrency: options.maxConcurrency ?? 5,
            delayMs: options.delayMs ?? 250,
            timeoutMs: options.timeoutMs ?? 15000,
            userAgent: options.userAgent || 'NymrelCrawlerMesh/1.0 (+https://github.com/nymrel/nymrel-crawler-mesh; AI Data Engine)',
            respectRobots: options.respectRobots ?? true,
            cache: options.cache ?? true,
            cacheDir: options.cacheDir || '.crawler-cache',
            cacheTtl: options.cacheTtl ?? 86400,
            domainMatchMode: options.domainMatchMode || 'same-domain',
            allowedDomains: options.allowedDomains || [],
            deniedPatterns: options.deniedPatterns || [],
            includeSitemaps: options.includeSitemaps ?? false,
            extractorOptions: options.extractorOptions || {},
            headers: options.headers || {},
            fetch: options.fetch || globalThis.fetch
        };
        this.cache = new ContentCache({
            enabled: this.config.cache,
            cacheDir: this.config.cacheDir,
            ttlSeconds: this.config.cacheTtl
        });
        this.rateLimiter = new PoliteRateLimiter({
            defaultDelayMs: this.config.delayMs,
            maxConcurrencyPerDomain: this.config.maxConcurrency
        });
    }
    async getRobotsParser(urlStr) {
        if (!this.config.respectRobots)
            return null;
        let origin = '';
        try {
            origin = new URL(urlStr).origin;
        }
        catch {
            return null;
        }
        if (this.robotsCache.has(origin)) {
            return this.robotsCache.get(origin);
        }
        const robotsUrl = `${origin}/robots.txt`;
        const parser = new RobotsParser();
        try {
            const fetchFn = this.config.fetch || globalThis.fetch;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const resp = await fetchFn(robotsUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': this.config.userAgent || 'NymrelCrawlerMesh/1.0'
                }
            });
            clearTimeout(timeout);
            if (resp.ok) {
                const text = await resp.text();
                parser.parse(text);
                const crawlDelay = parser.getCrawlDelay(this.config.userAgent);
                if (crawlDelay !== undefined && crawlDelay > 0) {
                    const domain = extractDomain(urlStr);
                    this.rateLimiter.setDomainDelay(domain, crawlDelay * 1000);
                }
            }
        }
        catch {
            // If robots.txt fails or 404s, allow crawling
        }
        this.robotsCache.set(origin, parser);
        return parser;
    }
    async crawlUrl(rawUrl, options = {}) {
        const startTime = Date.now();
        const fetchFn = options.fetch || this.config.fetch || globalThis.fetch;
        const timeoutMs = options.timeoutMs ?? this.config.timeoutMs ?? 15000;
        const userAgent = options.userAgent || this.config.userAgent || 'NymrelCrawlerMesh/1.0';
        const respectRobots = options.respectRobots ?? this.config.respectRobots ?? true;
        const useCache = options.cache ?? this.config.cache ?? true;
        // 1. Check robots.txt
        if (respectRobots) {
            const robots = await this.getRobotsParser(rawUrl);
            if (robots && !robots.isAllowed(rawUrl, userAgent)) {
                throw new Error(`Crawl disallowed by robots.txt for URL: ${rawUrl}`);
            }
        }
        // 2. Check cache
        if (useCache) {
            const cached = await this.cache.get(rawUrl);
            if (cached) {
                const result = {
                    url: cached.url,
                    canonicalUrl: cached.metadata.canonical,
                    statusCode: cached.statusCode,
                    statusText: cached.statusText,
                    headers: cached.headers,
                    contentType: cached.contentType,
                    fromCache: true,
                    contentHash: cached.hash,
                    durationMs: Date.now() - startTime,
                    depth: 0,
                    markdown: cached.markdown,
                    text: cached.text,
                    html: cached.html,
                    metadata: cached.metadata,
                    links: cached.links,
                    images: cached.images,
                    tables: cached.tables,
                    codeBlocks: cached.codeBlocks
                };
                this.emit('cached', result);
                return result;
            }
        }
        // 3. Rate limiter acquire
        await this.rateLimiter.acquire(rawUrl);
        let response;
        let html = '';
        let statusCode = 0;
        let statusText = '';
        const headersRecord = {};
        let contentType = 'text/html';
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            const conditionalHeaders = useCache ? this.cache.getConditionalHeaders(rawUrl) : {};
            const reqHeaders = {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                ...this.config.headers,
                ...options.headers,
                ...conditionalHeaders
            };
            response = await fetchFn(rawUrl, {
                signal: controller.signal,
                headers: reqHeaders,
                redirect: 'follow'
            });
            clearTimeout(timeout);
            statusCode = response.status;
            statusText = response.statusText;
            response.headers.forEach((val, key) => {
                headersRecord[key.toLowerCase()] = val;
            });
            contentType = headersRecord['content-type'] || 'text/html';
            // 304 Not Modified support
            if (statusCode === 304) {
                const revalidatedEntry = await this.cache.get(rawUrl);
                if (revalidatedEntry) {
                    this.rateLimiter.release(rawUrl, 304);
                    return {
                        url: rawUrl,
                        canonicalUrl: revalidatedEntry.metadata.canonical,
                        statusCode: 200,
                        statusText: 'OK (304 Not Modified)',
                        headers: headersRecord,
                        contentType: revalidatedEntry.contentType,
                        fromCache: true,
                        contentHash: revalidatedEntry.hash,
                        durationMs: Date.now() - startTime,
                        depth: 0,
                        markdown: revalidatedEntry.markdown,
                        text: revalidatedEntry.text,
                        html: revalidatedEntry.html,
                        metadata: revalidatedEntry.metadata,
                        links: revalidatedEntry.links,
                        images: revalidatedEntry.images,
                        tables: revalidatedEntry.tables,
                        codeBlocks: revalidatedEntry.codeBlocks
                    };
                }
            }
            if (!response.ok) {
                this.rateLimiter.release(rawUrl, statusCode);
                throw new Error(`HTTP ${statusCode} ${statusText}`);
            }
            html = await response.text();
            this.rateLimiter.release(rawUrl, statusCode);
        }
        catch (err) {
            this.rateLimiter.release(rawUrl, statusCode || 500);
            throw err;
        }
        // 4. Extract clean Markdown & structured data
        const extraction = extractMarkdown(html, {
            ...this.config.extractorOptions,
            ...options.extractorOptions,
            baseUrl: rawUrl
        });
        const contentHash = this.cache.computeHash(html);
        const durationMs = Date.now() - startTime;
        const result = {
            url: rawUrl,
            canonicalUrl: extraction.metadata.canonical,
            statusCode,
            statusText,
            headers: headersRecord,
            contentType,
            fromCache: false,
            contentHash,
            durationMs,
            depth: 0,
            markdown: extraction.markdown,
            text: extraction.text,
            html,
            metadata: extraction.metadata,
            links: extraction.links,
            images: extraction.images,
            tables: extraction.tables,
            codeBlocks: extraction.codeBlocks
        };
        // 5. Store in cache
        if (useCache) {
            await this.cache.set(rawUrl, {
                url: rawUrl,
                statusCode,
                statusText,
                headers: headersRecord,
                contentType,
                html,
                markdown: extraction.markdown,
                text: extraction.text,
                metadata: extraction.metadata,
                links: extraction.links,
                images: extraction.images,
                tables: extraction.tables,
                codeBlocks: extraction.codeBlocks,
                etag: headersRecord['etag'],
                lastModified: headersRecord['last-modified']
            });
        }
        this.emit('page', result);
        return result;
    }
    async crawl(startUrl, options = {}) {
        const startTime = Date.now();
        const effectiveConfig = { ...this.config, ...options };
        const startUrls = Array.isArray(startUrl) ? startUrl : [startUrl];
        const startDomains = startUrls.map(u => {
            try {
                return new URL(u).hostname;
            }
            catch {
                return '';
            }
        }).filter(Boolean);
        const queue = new CrawlQueue({
            startDomains,
            domainMatchMode: effectiveConfig.domainMatchMode,
            allowedDomains: effectiveConfig.allowedDomains,
            deniedPatterns: effectiveConfig.deniedPatterns,
            maxDepth: effectiveConfig.maxDepth
        });
        // Seed initial URLs
        for (const url of startUrls) {
            queue.enqueue({ url, depth: 0 });
        }
        // Discover sitemap if configured
        if (effectiveConfig.includeSitemaps) {
            for (const url of startUrls) {
                try {
                    const origin = new URL(url).origin;
                    const sitemapUrl = `${origin}/sitemap.xml`;
                    const sitemapData = await fetchAndParseSitemap(sitemapUrl, {
                        fetch: effectiveConfig.fetch,
                        userAgent: effectiveConfig.userAgent
                    });
                    for (const entry of sitemapData.urls) {
                        queue.enqueue({ url: entry.loc, depth: 1 });
                    }
                }
                catch {
                    // ignore sitemap discovery errors
                }
            }
        }
        const results = [];
        let cachedCount = 0;
        let errorCount = 0;
        const maxPages = effectiveConfig.maxPages ?? 50;
        const maxConcurrency = effectiveConfig.maxConcurrency ?? 5;
        const worker = async () => {
            while (!queue.isEmpty() && results.length < maxPages) {
                const item = queue.dequeue();
                if (!item)
                    break;
                if (queue.hasVisited(item.url)) {
                    continue;
                }
                queue.markVisited(item.url);
                try {
                    const result = await this.crawlUrl(item.url, {
                        timeoutMs: effectiveConfig.timeoutMs,
                        userAgent: effectiveConfig.userAgent,
                        respectRobots: effectiveConfig.respectRobots,
                        cache: effectiveConfig.cache,
                        headers: effectiveConfig.headers,
                        extractorOptions: effectiveConfig.extractorOptions,
                        fetch: effectiveConfig.fetch
                    });
                    result.depth = item.depth;
                    results.push(result);
                    if (result.fromCache)
                        cachedCount++;
                    const progress = {
                        crawledCount: results.length,
                        queuedCount: queue.size(),
                        cachedCount,
                        errorCount,
                        currentUrl: item.url,
                        elapsedMs: Date.now() - startTime
                    };
                    this.emit('progress', progress);
                    // Enqueue discovered internal links if under maxDepth
                    if (item.depth < (effectiveConfig.maxDepth ?? 2)) {
                        for (const link of result.links) {
                            if (link.isInternal && link.href) {
                                queue.enqueue({
                                    url: link.href,
                                    depth: item.depth + 1,
                                    referrer: item.url
                                });
                            }
                        }
                    }
                }
                catch (err) {
                    errorCount++;
                    if (this.listenerCount('error') > 0) {
                        this.emit('error', { url: item.url, error: err, depth: item.depth });
                    }
                }
            }
        };
        const workers = Array.from({ length: maxConcurrency }, () => worker());
        await Promise.all(workers);
        const summary = {
            startUrl: Array.isArray(startUrl) ? startUrl[0] : startUrl,
            totalCrawled: results.length,
            totalQueued: queue.size() + results.length,
            totalCached: cachedCount,
            totalErrors: errorCount,
            durationMs: Date.now() - startTime,
            results
        };
        this.emit('done', summary);
        return summary;
    }
    async *crawlStream(startUrl, options = {}) {
        const summary = await this.crawl(startUrl, options);
        for (const result of summary.results) {
            yield result;
        }
    }
    async benchmark(targetUrl, count = 20, concurrency = 5) {
        const latencies = [];
        const extractionTimes = [];
        let successCount = 0;
        let failCount = 0;
        let totalBytes = 0;
        let cacheHits = 0;
        const startBench = Date.now();
        const tasks = Array.from({ length: count }, async (_, i) => {
            const iterStart = Date.now();
            try {
                const result = await this.crawlUrl(targetUrl, { cache: i > 0 });
                const latency = Date.now() - iterStart;
                latencies.push(latency);
                extractionTimes.push(result.durationMs);
                totalBytes += result.html.length;
                if (result.fromCache)
                    cacheHits++;
                successCount++;
            }
            catch {
                failCount++;
            }
        });
        // Run with concurrency pool
        for (let i = 0; i < tasks.length; i += concurrency) {
            await Promise.all(tasks.slice(i, i + concurrency));
        }
        const totalDurationMs = Math.max(1, Date.now() - startBench);
        latencies.sort((a, b) => a - b);
        const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
        const minLatencyMs = latencies[0] || 0;
        const maxLatencyMs = latencies[latencies.length - 1] || 0;
        const p95Index = Math.floor(latencies.length * 0.95);
        const p95LatencyMs = latencies[p95Index] || maxLatencyMs;
        const avgMarkdownExtractionMs = extractionTimes.length > 0
            ? extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length
            : 0;
        return {
            targetUrl,
            totalRequests: count,
            successfulRequests: successCount,
            failedRequests: failCount,
            totalDurationMs,
            requestsPerSecond: parseFloat(((count / totalDurationMs) * 1000).toFixed(2)),
            avgLatencyMs: parseFloat(avgLatencyMs.toFixed(2)),
            minLatencyMs,
            maxLatencyMs,
            p95LatencyMs,
            avgMarkdownExtractionMs: parseFloat(avgMarkdownExtractionMs.toFixed(2)),
            totalBytesDownloaded: totalBytes,
            cacheHitRate: parseFloat(((cacheHits / count) * 100).toFixed(1))
        };
    }
    async clearCache() {
        await this.cache.clear();
    }
}
//# sourceMappingURL=mesh.js.map