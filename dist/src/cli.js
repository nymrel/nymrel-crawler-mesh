/**
 * @nymrel/crawler-mesh
 * Unified CLI Driver
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CrawlerMesh } from './crawler/mesh.js';
import { extractMarkdown } from './extractor/index.js';
import { fetchAndParseSitemap, parseSitemapXml } from './crawler/sitemap.js';
import { fetchWithPolicy, readResponseText } from './crawler/network-policy.js';
const VERSION = '1.0.0';
export function printHelp() {
    console.log(`
\x1b[1m\x1b[36mnymrel-crawler-mesh\x1b[0m v${VERSION}
Bounded, Zero-Telemetry HTTP Crawler & Markdown/JSON Extractor

\x1b[1mUSAGE:\x1b[0m
  crawler-mesh <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[32mcrawl\x1b[0m <url>        Crawl a URL or entire site recursively
  \x1b[32mextract\x1b[0m <url|file> Extract clean Markdown or JSON from URL, file, or stdin (-)
  \x1b[32msitemap\x1b[0m <url>      Parse XML sitemap or sitemap index
  \x1b[32mbench\x1b[0m <url>        Run a bounded request benchmark
  \x1b[32mversion\x1b[0m            Print version information
  \x1b[32mhelp\x1b[0m               Show this help message

\x1b[1mOPTIONS (crawl):\x1b[0m
  --max-depth <n>       Max crawl depth (default: 2)
  --max-pages <n>       Max total pages to fetch (default: 20)
  --concurrency <n>     Concurrent requests (default: 5)
  --delay <ms>          Polite delay between requests to same domain (default: 250)
  --output <dir>        Directory to write extracted documents
  --format <md|json>    Output format (default: md)
  --no-cache            Disable SHA-256 caching
  --ignore-robots       Bypass robots.txt checks
  --user-agent <str>    Custom User-Agent header
  --sitemaps            Auto-discover and ingest sitemaps
  --allow-private-networks  Opt in to loopback/private network targets
  --silent              Suppress progress logs
  --verbose             Verbose logging

\x1b[1mOPTIONS (extract):\x1b[0m
  --format <md|json>    Output format: md (default) or json
  --no-frontmatter      Omit YAML metadata frontmatter
  --strip-links         Remove hyperlinks from markdown body
  --strip-images        Remove image tags from markdown body
  --output <file>       Write result directly to file

\x1b[1mOPTIONS (sitemap):\x1b[0m
  --crawl               Immediately crawl all discovered URLs
  --output <file>       Save discovered URLs to file

\x1b[1mOPTIONS (bench):\x1b[0m
  --requests <n>        Total benchmark requests (default: 20)
  --concurrency <n>     Concurrency pool size (default: 5)

\x1b[1mEXAMPLES:\x1b[0m
  crawler-mesh crawl https://docs.example.com --max-depth 2 --output ./crawled
  crawler-mesh extract https://example.com/blog/post-1 --format md
  cat page.html | crawler-mesh extract - --format json
  crawler-mesh sitemap https://example.com/sitemap.xml
  crawler-mesh bench https://example.com --requests 50 --concurrency 10
`);
}
export async function runCli(args) {
    if (args.length === 0 || args.includes('--help') || args.includes('-h') || args[0] === 'help') {
        printHelp();
        return 0;
    }
    if (args.includes('--version') || args.includes('-v') || args[0] === 'version') {
        console.log(`@nymrel/crawler-mesh v${VERSION}`);
        return 0;
    }
    const command = args[0];
    const remaining = args.slice(1);
    switch (command) {
        case 'crawl':
            return handleCrawl(remaining);
        case 'extract':
            return handleExtract(remaining);
        case 'sitemap':
            return handleSitemap(remaining);
        case 'bench':
            return handleBench(remaining);
        default:
            console.error(`Unknown command: ${command}`);
            printHelp();
            return 1;
    }
}
async function handleCrawl(args) {
    const url = args.find(a => !a.startsWith('-'));
    if (!url) {
        console.error('Error: Missing required URL for crawl command');
        return 1;
    }
    const maxDepth = parseInt(getArg(args, '--max-depth') || '2', 10);
    const maxPages = parseInt(getArg(args, '--max-pages') || '20', 10);
    const concurrency = parseInt(getArg(args, '--concurrency') || '5', 10);
    const delay = parseInt(getArg(args, '--delay') || '250', 10);
    const outputDir = getArg(args, '--output');
    const format = (getArg(args, '--format') || 'md').toLowerCase();
    const noCache = args.includes('--no-cache');
    const ignoreRobots = args.includes('--ignore-robots');
    const userAgent = getArg(args, '--user-agent');
    const includeSitemaps = args.includes('--sitemaps');
    const silent = args.includes('--silent');
    const verbose = args.includes('--verbose');
    const allowPrivateNetworks = args.includes('--allow-private-networks');
    if (!silent) {
        console.log(`\x1b[1m\x1b[36m=== Starting Crawler Mesh ===\x1b[0m`);
        console.log(`Target URL:     ${url}`);
        console.log(`Max Depth:      ${maxDepth} | Max Pages: ${maxPages} | Concurrency: ${concurrency}`);
        console.log(`Cache:          ${noCache ? 'Disabled' : 'Enabled (.crawler-cache)'}`);
        console.log(`Robots.txt:     ${ignoreRobots ? 'Ignored' : 'Enforced'}\n`);
    }
    const mesh = new CrawlerMesh({
        maxDepth,
        maxPages,
        maxConcurrency: concurrency,
        delayMs: delay,
        cache: !noCache,
        respectRobots: !ignoreRobots,
        userAgent,
        includeSitemaps,
        allowPrivateNetworks
    });
    if (!silent) {
        mesh.on('page', (res) => {
            const cacheTag = res.fromCache ? '\x1b[33m[CACHE]\x1b[0m' : '\x1b[32m[FETCH]\x1b[0m';
            console.log(`${cacheTag} (${res.statusCode}) [Depth ${res.depth}] ${res.url} - ${res.metadata.title || 'Untitled'} (${res.metadata.estimatedTokens} tokens)`);
        });
        mesh.on('error', (err) => {
            console.error(`\x1b[31m[ERROR]\x1b[0m ${err.url}: ${err.error.message}`);
        });
    }
    const summary = await mesh.crawl(url);
    if (outputDir) {
        await fs.mkdir(outputDir, { recursive: true });
        for (let i = 0; i < summary.results.length; i++) {
            const res = summary.results[i];
            const safeName = `page_${i + 1}_` + (res.metadata.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
            const ext = format === 'json' ? '.json' : '.md';
            const filePath = path.join(outputDir, `${safeName}${ext}`);
            if (format === 'json') {
                await fs.writeFile(filePath, JSON.stringify(res, null, 2), 'utf-8');
            }
            else {
                await fs.writeFile(filePath, res.markdown, 'utf-8');
            }
        }
        if (!silent) {
            console.log(`\n\x1b[32mSaved ${summary.results.length} extracted files to ${outputDir}\x1b[0m`);
        }
    }
    if (!silent) {
        console.log(`\n\x1b[1m\x1b[36m=== Crawl Completed ===\x1b[0m`);
        console.log(`Total Crawled:  ${summary.totalCrawled}`);
        console.log(`Cache Hits:     ${summary.totalCached}`);
        console.log(`Errors:         ${summary.totalErrors}`);
        console.log(`Duration:       ${(summary.durationMs / 1000).toFixed(2)}s`);
    }
    return summary.totalErrors > 0 && summary.totalCrawled === 0 ? 1 : 0;
}
async function handleExtract(args) {
    const target = args.find(a => !a.startsWith('-'));
    if (!target) {
        console.error('Error: Missing required URL, file path, or "-" for stdin');
        return 1;
    }
    const format = (getArg(args, '--format') || 'md').toLowerCase();
    const noFrontmatter = args.includes('--no-frontmatter');
    const stripLinks = args.includes('--strip-links');
    const stripImages = args.includes('--strip-images');
    const outputFile = getArg(args, '--output');
    let rawHtml = '';
    let baseUrl = '';
    if (target === '-') {
        // Read from stdin
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        rawHtml = Buffer.concat(chunks).toString('utf-8');
    }
    else if (target.startsWith('http://') || target.startsWith('https://')) {
        baseUrl = target;
        const { response, finalUrl } = await fetchWithPolicy(target, {
            headers: { 'User-Agent': 'NymrelCrawlerMesh/1.0 AI Data Engine' }
        }, {
            allowPrivateNetworks: args.includes('--allow-private-networks')
        });
        if (!response.ok) {
            await response.body?.cancel();
            console.error(`Remote extraction failed: HTTP ${response.status}`);
            return 1;
        }
        baseUrl = finalUrl;
        rawHtml = await readResponseText(response);
    }
    else {
        rawHtml = await fs.readFile(target, 'utf-8');
    }
    const extraction = extractMarkdown(rawHtml, {
        baseUrl,
        includeFrontmatter: !noFrontmatter,
        stripLinks,
        stripImages
    });
    const outputContent = format === 'json'
        ? JSON.stringify(extraction, null, 2)
        : extraction.markdown;
    if (outputFile) {
        await fs.writeFile(outputFile, outputContent, 'utf-8');
        console.log(`Wrote extracted content to ${outputFile}`);
    }
    else {
        console.log(outputContent);
    }
    return 0;
}
async function handleSitemap(args) {
    const url = args.find(a => !a.startsWith('-'));
    if (!url) {
        console.error('Error: Missing sitemap URL or file path');
        return 1;
    }
    const doCrawl = args.includes('--crawl');
    const outputFile = getArg(args, '--output');
    let result;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        result = await fetchAndParseSitemap(url, {
            allowPrivateNetworks: args.includes('--allow-private-networks')
        });
    }
    else {
        const content = await fs.readFile(url, 'utf-8');
        result = parseSitemapXml(content);
    }
    console.log(`\x1b[1m\x1b[36m=== Sitemap Parsing Result ===\x1b[0m`);
    console.log(`Total URLs found:      ${result.urls.length}`);
    console.log(`Child Sitemaps found:  ${result.sitemaps.length}`);
    if (result.errors.length > 0) {
        console.log(`Errors encountered:    ${result.errors.length}`);
    }
    if (outputFile) {
        const data = JSON.stringify(result, null, 2);
        await fs.writeFile(outputFile, data, 'utf-8');
        console.log(`Saved sitemap results to ${outputFile}`);
    }
    else if (!doCrawl) {
        for (const entry of result.urls.slice(0, 30)) {
            console.log(` - ${entry.loc}${entry.lastmod ? ` (mod: ${entry.lastmod})` : ''}`);
        }
        if (result.urls.length > 30) {
            console.log(` ... and ${result.urls.length - 30} more`);
        }
    }
    if (doCrawl && result.urls.length > 0) {
        const urlsToCrawl = result.urls.map(u => u.loc);
        console.log(`\nLaunching crawler mesh on ${urlsToCrawl.length} sitemap URLs...`);
        const mesh = new CrawlerMesh({
            allowPrivateNetworks: args.includes('--allow-private-networks')
        });
        const summary = await mesh.crawl(urlsToCrawl);
        console.log(`Finished crawling sitemap URLs. Total crawled: ${summary.totalCrawled}`);
    }
    return 0;
}
async function handleBench(args) {
    const url = args.find(a => !a.startsWith('-'));
    if (!url) {
        console.error('Error: Missing target URL for benchmark');
        return 1;
    }
    const count = parseInt(getArg(args, '--requests') || '20', 10);
    const concurrency = parseInt(getArg(args, '--concurrency') || '5', 10);
    console.log(`\x1b[1m\x1b[36m=== Running Crawler Mesh Benchmark ===\x1b[0m`);
    console.log(`Target:      ${url}`);
    console.log(`Requests:    ${count} total requests`);
    console.log(`Concurrency: ${concurrency} parallel workers\n`);
    const mesh = new CrawlerMesh({
        allowPrivateNetworks: args.includes('--allow-private-networks')
    });
    const bench = await mesh.benchmark(url, count, concurrency);
    console.log(`\x1b[1m\x1b[32m=== Benchmark Results ===\x1b[0m`);
    console.log(`Throughput:             \x1b[1m${bench.requestsPerSecond} req/sec\x1b[0m`);
    console.log(`Successful Requests:    ${bench.successfulRequests} / ${bench.totalRequests}`);
    console.log(`Total Duration:         ${(bench.totalDurationMs / 1000).toFixed(2)}s`);
    console.log(`Avg Latency:            ${bench.avgLatencyMs} ms`);
    console.log(`Min / Max Latency:      ${bench.minLatencyMs} ms / ${bench.maxLatencyMs} ms`);
    console.log(`P95 Latency:            ${bench.p95LatencyMs} ms`);
    console.log(`Avg Markdown Parsing:   ${bench.avgMarkdownExtractionMs} ms`);
    console.log(`Cache Hit Rate:         ${bench.cacheHitRate} %`);
    console.log(`Total Bytes:            ${(bench.totalBytesDownloaded / 1024).toFixed(2)} KB`);
    return 0;
}
function getArg(args, flag) {
    const index = args.indexOf(flag);
    if (index !== -1 && index + 1 < args.length) {
        return args[index + 1];
    }
    return undefined;
}
//# sourceMappingURL=cli.js.map