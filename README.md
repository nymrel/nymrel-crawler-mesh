<div align="center">

# 🕷️ nymrel-crawler-mesh

**High-Throughput, Zero-Telemetry Web Crawler & Semantic Markdown/JSON Extractor for AI Agents and LLM Pipelines**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933.svg?logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-%3E%3D3.9-3776AB.svg?logo=python)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero%20(Local%20Only)-blue.svg)](#zero-telemetry-guarantee)
[![Nymrel](https://img.shields.io/badge/Entity-Nymrel%20%7C%20JalenBuilds%20LLC-darkgreen.svg)](https://jalenbuilds.com)

*Dual Engine: Native TypeScript / Node.js + Python with 100% Feature Parity*

</div>

---

## 🌟 Overview

`nymrel-crawler-mesh` is an open-source, enterprise-grade web scraping engine and clean document transformer designed specifically for autonomous AI agents, retrieval-augmented generation (RAG) indexing, and LLM training datasets.

Unlike traditional heavy scrapers that bundle bulky headless browsers or leak telemetry to third-party analytics services, `nymrel-crawler-mesh` runs **100% locally** with ultra-fast asynchronous concurrency, polite domain rate limiting, RFC 9309 robots.txt compliance, and an intelligent semantic AST transformer that converts messy HTML into pristine GitHub-Flavored Markdown.

---

## 🏗️ Architecture

```
                                  [ TARGET URL / SITEMAP ]
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │       CRAWLER MESH CONTROLLER             │
                       └─────────────────────┬─────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
                       ▼                                           ▼
         ┌───────────────────────────┐               ┌───────────────────────────┐
         │   RFC 9309 ROBOTS.TXT     │               │    POLITE RATE LIMITER    │
         │ - Wildcard / $ Anchors    │               │ - Domain Token Bucket     │
         │ - Specificity Precedence  │               │ - Concurrency Limiter     │
         │ - Crawl-Delay Directives  │               │ - Exponential Backoff     │
         └─────────────┬─────────────┘               └─────────────┬─────────────┘
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │     SHA-256 CONTENT CACHING LAYER         │
                       │ - Normalized URL Deduplication            │
                       │ - Memory + Filesystem Persistence         │
                       │ - ETag / If-Modified-Since 304 Support    │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │        HTTP CONCURRENCY WORKERS           │
                       │ - Asynchronous FIFO/Priority Queue        │
                       │ - Max-Depth / Domain Boundary Bounds      │
                       └─────────────────────┬─────────────────────┘
                                             │ (Raw HTML Stream)
                                             ▼
         ┌───────────────────────────────────────────────────────────────────────┐
         │                    SEMANTIC AST EXTRACTOR                             │
         │                                                                       │
         │  [ NOISE STRIPPER ]               [ METADATA EXTRACTOR ]              │
         │  - Strips scripts & styles        - OpenGraph & Twitter Cards         │
         │  - Strips navbars & footers       - Canonical URLs & Title            │
         │  - Strips ads & cookie banners    - Token Estimation (~3.8 char/tok)  │
         │  - Removes 1x1 tracking pixels    - Author, Language, Publication     │
         │                                                                       │
         │  [ AST TRANSFORMER ]              [ MARKDOWN EMITTER ]                │
         │  - Tables -> Aligned GFM Tables   - YAML Frontmatter Injection        │
         │  - Code -> Fenced Code Blocks     - Heading Hierarchy Preservation    │
         │  - Links -> Cleaned Absolute URLs - Clean Lists & Blockquotes         │
         └───────────────────────────────────┬───────────────────────────────────┘
                                             │
                                             ▼
                         [ PRISTINE MARKDOWN & STRUCTURED JSON ]
```

---

## ✨ Key Features

- ⚡ **Dual Engine Parity**: Complete implementations in both **TypeScript / Node.js** (native `fetch` & `node:test`) and **Python 3.9+** (`asyncio` & `unittest`).
- 🛡️ **Zero Telemetry**: No tracking beacons, analytics pings, or phone-home requests. Complete data privacy.
- 🧹 **Noise-Free Markdown**: Strips ads, navigation bars, cookie banners, overlays, social widgets, and 1x1 tracking pixels while preserving headings, lists, blockquotes, links, and images.
- 📊 **Table & Code Fidelity**: Transforms complex HTML tables into clean GFM Markdown tables and preserves fenced code blocks with language identifiers.
- 🏷️ **YAML Metadata Frontmatter**: Automatically extracts document title, description, canonical link, author, publication date, language, word count, and accurate LLM token estimates.
- 🚦 **Polite Domain Rate Limiting**: Per-domain token bucket delays with jittered exponential backoff on HTTP 429/503.
- 🤖 **RFC 9309 Robots.txt Compliance**: Strict robots.txt parser supporting path wildcards (`*`), end anchors (`$`), specificity resolution, and crawl delays.
- 🗺️ **Sitemap & SitemapIndex Ingestion**: Seamlessly discovers and parses XML sitemaps and recursive sitemap indexes.
- 💾 **SHA-256 Content-Hash Cache**: Intelligent deduplication layer with HTTP conditional header support (`If-None-Match`, `If-Modified-Since`) to handle `304 Not Modified` responses without bandwidth waste.
- 🚀 **High-Throughput Benchmarking**: Built-in benchmarking utility to measure requests/sec, P95 latency, and Markdown extraction rate.

---

## 📦 Installation

### Node.js / TypeScript (npm)

```bash
# Install as a project dependency
npm install @nymrel/crawler-mesh

# Or install globally for CLI access
npm install -g @nymrel/crawler-mesh
```

### Python (pip)

```bash
# Install via pip
pip install nymrel-crawler-mesh

# Or install from source
git clone https://github.com/nymrel/nymrel-crawler-mesh.git
cd nymrel-crawler-mesh
pip install -e .
```

---

## 💻 CLI Usage

The `crawler-mesh` CLI provides high-performance terminal commands for scraping, extracting, sitemap discovery, and benchmarking.

```bash
# Display help
crawler-mesh --help

# 1. Crawl an entire site recursively and output clean Markdown files
crawler-mesh crawl https://docs.example.com \
  --max-depth 2 \
  --max-pages 50 \
  --concurrency 5 \
  --delay 250 \
  --output ./crawled-docs \
  --format md

# 2. Extract clean Markdown or JSON from a single URL
crawler-mesh extract https://example.com/blog/post-1 --format md

# 3. Pipe raw HTML from stdin directly into the extractor
cat raw_page.html | crawler-mesh extract - --format json

# 4. Discover all URLs inside an XML sitemap
crawler-mesh sitemap https://example.com/sitemap.xml --output sitemap.json

# 5. Run a high-throughput server benchmark
crawler-mesh bench https://example.com --requests 50 --concurrency 10
```

### Python CLI Entrypoint

```bash
crawler-mesh-py crawl https://docs.example.com --max-depth 2 --output ./crawled
crawler-mesh-py extract https://example.com/article --format md
crawler-mesh-py bench https://example.com --requests 20
```

---

## 🛠️ TypeScript SDK Guide

### Quick Single URL Crawl & Extraction

```typescript
import { crawlUrl, extractMarkdown } from '@nymrel/crawler-mesh';

// 1. Crawl URL directly
const result = await crawlUrl('https://example.com/docs/getting-started');

console.log('Title:', result.metadata.title);
console.log('Tokens:', result.metadata.estimatedTokens);
console.log('Markdown:\n', result.markdown);

// 2. Extract Markdown from existing HTML string
const html = '<main><h1>Hello World</h1><p>Scraping for AI.</p></main>';
const extracted = extractMarkdown(html, { baseUrl: 'https://example.com' });
console.log(extracted.markdown);
```

### Advanced Multi-Page Recursive Crawling

```typescript
import { CrawlerMesh } from '@nymrel/crawler-mesh';

const mesh = new CrawlerMesh({
  maxDepth: 3,
  maxPages: 100,
  maxConcurrency: 8,
  delayMs: 200,
  cache: true,
  cacheDir: '.custom-cache',
  respectRobots: true,
  userAgent: 'MyAiAgent/1.0 (+https://myagent.ai)',
  domainMatchMode: 'same-domain',
  includeSitemaps: true
});

// Event hooks for real-time streaming
mesh.on('page', (result) => {
  console.log(`[Crawled ${result.statusCode}] ${result.url} (${result.metadata.estimatedTokens} tokens)`);
});

mesh.on('error', ({ url, error }) => {
  console.error(`[Failed] ${url}: ${error.message}`);
});

const summary = await mesh.crawl('https://docs.example.com');
console.log(`Finished: Crawled ${summary.totalCrawled} pages in ${summary.durationMs}ms`);
```

---

## 🐍 Python SDK Guide

### Quick Single URL Crawl

```python
from nymrel_crawler_mesh import crawl_url, extract_markdown

# 1. Synchronous single URL crawl
result = crawl_url("https://example.com/docs/intro")
print("Title:", result.metadata.title)
print("Estimated Tokens:", result.metadata.estimated_tokens)
print("Markdown:\n", result.markdown)

# 2. Extract Markdown from raw HTML
html = "<article><h1>Deep Learning</h1><p>Modern transformers.</p></article>"
extraction = extract_markdown(html, base_url="https://example.com")
print(extraction.markdown)
```

### Asynchronous Multi-Page Crawler

```python
import asyncio
from nymrel_crawler_mesh import CrawlerMesh

async def main():
    mesh = CrawlerMesh(
        max_depth=2,
        max_pages=50,
        max_concurrency=5,
        delay_ms=250,
        cache=True,
        respect_robots=True
    )

    summary = await mesh.crawl(
        "https://docs.example.com",
        on_page=lambda res: print(f"Crawled: {res.url} ({res.metadata.title})")
    )
    print(f"Total crawled: {summary.total_crawled}")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 🧪 Extractor Fidelity & Noise Stripping

| Feature | Behavior |
|---|---|
| **Noise Stripping** | Drops `<script>`, `<style>`, `<noscript>`, `<svg>`, `<iframe>`, `<header>`, `<nav>`, `<footer>`, `<aside>`, `<dialog>` |
| **Ad / Banner Removal** | Strips elements matching `ad-container`, `banner-ad`, `cookie-banner`, `modal-overlay`, `social-share`, etc. |
| **Tracking Pixels** | Removes 1x1 `<img width="1" height="1">` and `display:none` trackers |
| **Table Conversion** | Formats `<table>` into aligned GitHub Flavored Markdown tables (`\| Col 1 \| Col 2 \|`) |
| **Code Preservation** | Preserves indentation in `<pre><code>` blocks and extracts language syntax (`python`, `ts`, etc.) |
| **Link Normalization** | Converts relative links (`href="/docs"`) into absolute URLs using `baseUrl` |
| **Token Estimation** | Computes estimated LLM token count (~3.8 characters per token for English text) |
| **Frontmatter** | Injects clean YAML metadata frontmatter (`title`, `description`, `canonical`, `words`, `tokens`, `extractedAt`) |

---

## 🔒 Zero-Telemetry Guarantee

`nymrel-crawler-mesh` is committed to absolute user and data privacy:
- 🚫 **No Phone-Home**: Never sends analytics, usage telemetry, IP pings, or diagnostic data to external servers.
- 💻 **100% Local Compute**: All parsing, hashing, token counting, and caching logic run entirely on the local runtime.
- 🛡️ **Air-Gapped Friendly**: Compatible with air-gapped environments and private internal networks.

---

## 🏢 Entity & Trust Metadata

`nymrel-crawler-mesh` is part of the **Nymrel** digital ecosystem under **JalenBuilds LLC**.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  "name": "nymrel-crawler-mesh",
  "codeRepository": "https://github.com/nymrel/nymrel-crawler-mesh",
  "author": {
    "@type": "Organization",
    "name": "Nymrel",
    "parentOrganization": {
      "@type": "Organization",
      "name": "JalenBuilds LLC",
      "email": "contact@nymrel.com"
    }
  },
  "license": "https://opensource.org/licenses/MIT",
  "programmingLanguage": ["TypeScript", "Python"],
  "applicationCategory": "DeveloperApplication",
  "description": "High-throughput, zero-telemetry web crawler and semantic markdown extractor for AI agents."
}
```

Machine-readable specification available at [`/llms.txt`](./llms.txt).

---

## 🚦 Testing & Verification

Both test suites run independently and require no external network access (fully mocked & isolated):

```bash
# 1. Run Node.js / TypeScript test suite (22 unit tests)
npm test

# 2. Run Python test suite (14 unit tests)
python -m unittest discover -s tests -v
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

Copyright &copy; 2026 **Nymrel / JalenBuilds LLC**. All rights reserved.
