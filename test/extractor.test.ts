/**
 * @nymrel/crawler-mesh
 * Extractor Test Suite
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMarkdown, extractMetadata, cleanHtml } from '../src/extractor/index.js';

describe('Semantic HTML Extractor', () => {
  it('strips navbars, footers, scripts, tracking pixels, and ads', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Article Page</title>
          <meta name="description" content="A test article for crawler mesh">
        </head>
        <body>
          <header class="site-header">
            <nav class="navbar"><a href="/home">Home</a><a href="/about">About</a></nav>
          </header>
          <div class="ad-container"><p>Buy something now!</p></div>
          <div class="cookie-banner"><p>Accept all cookies?</p></div>
          <img src="/pixel.gif" width="1" height="1" alt="tracking" />
          <main>
            <h1>Understanding Web Crawling</h1>
            <p>Web crawling is an essential technique for indexing the web.</p>
            <p>Modern crawlers must be polite and fast.</p>
          </main>
          <div class="social-share"><button>Share on Twitter</button></div>
          <footer class="site-footer">
            <p>&copy; 2026 Example Corp. All rights reserved.</p>
          </footer>
          <script>console.log('analytics');</script>
        </body>
      </html>
    `;

    const result = extractMarkdown(rawHtml);

    assert.ok(result.markdown.includes('# Understanding Web Crawling'), 'Should include main heading');
    assert.ok(result.markdown.includes('Web crawling is an essential technique'), 'Should include paragraph text');
    assert.ok(!result.markdown.includes('Home'), 'Should strip navbar');
    assert.ok(!result.markdown.includes('Buy something now!'), 'Should strip ad container');
    assert.ok(!result.markdown.includes('Accept all cookies?'), 'Should strip cookie banner');
    assert.ok(!result.markdown.includes('Share on Twitter'), 'Should strip social share');
    assert.ok(!result.markdown.includes('&copy; 2026 Example Corp'), 'Should strip footer');
    assert.ok(!result.markdown.includes('console.log'), 'Should strip scripts');
  });

  it('converts complex HTML tables to Markdown tables with aligned columns', () => {
    const htmlWithTable = `
      <main>
        <h2>Benchmarking Results</h2>
        <table>
          <thead>
            <tr>
              <th>Engine</th>
              <th>Throughput (req/s)</th>
              <th>Latency (ms)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nymrel Mesh</td>
              <td>12,500</td>
              <td>1.4</td>
            </tr>
            <tr>
              <td>Legacy Crawler</td>
              <td>1,200</td>
              <td>18.9</td>
            </tr>
          </tbody>
        </table>
      </main>
    `;

    const result = extractMarkdown(htmlWithTable);

    assert.ok(result.markdown.includes('| Engine'), 'Should include table header');
    assert.ok(result.markdown.includes('| ---') || result.markdown.includes('|-'), 'Should include separator');
    assert.ok(result.markdown.includes('| Nymrel Mesh'), 'Should include row 1');
    assert.ok(result.markdown.includes('| Legacy Crawler'), 'Should include row 2');
    assert.equal(result.tables.length, 1, 'Should extract structured table');
    assert.deepEqual(result.tables[0].headers, ['Engine', 'Throughput (req/s)', 'Latency (ms)']);
  });

  it('preserves code blocks with language identifiers', () => {
    const htmlWithCode = `
      <main>
        <h3>Python Example</h3>
        <pre><code class="language-python">
def crawl(url):
    mesh = CrawlerMesh()
    return mesh.crawl_url(url)
        </code></pre>
      </main>
    `;

    const result = extractMarkdown(htmlWithCode);

    assert.ok(result.markdown.includes('```python'), 'Should identify python language');
    assert.ok(result.markdown.includes('def crawl(url):'), 'Should preserve code content');
    assert.equal(result.codeBlocks.length, 1);
    assert.equal(result.codeBlocks[0].language, 'python');
  });

  it('extracts rich metadata, OpenGraph, and estimates LLM tokens', () => {
    const richHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>AI Data Engineering Best Practices</title>
          <meta name="description" content="Complete guide to scraping for LLM pipelines.">
          <meta name="author" content="Jalen">
          <meta property="og:title" content="AI Data Engineering Best Practices">
          <meta property="og:description" content="Complete guide to scraping for LLM pipelines.">
          <meta property="og:url" content="https://nymrel.com/guides/ai-data">
          <meta name="keywords" content="ai, llm, crawler, scraper">
          <link rel="canonical" href="https://nymrel.com/guides/ai-data">
        </head>
        <body>
          <main>
            <h1>AI Data Engineering Best Practices</h1>
            <p>High-quality data ingestion determines downstream model performance.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractMarkdown(richHtml);

    assert.equal(result.metadata.title, 'AI Data Engineering Best Practices');
    assert.equal(result.metadata.description, 'Complete guide to scraping for LLM pipelines.');
    assert.equal(result.metadata.canonical, 'https://nymrel.com/guides/ai-data');
    assert.equal(result.metadata.author, 'Jalen');
    assert.equal(result.metadata.language, 'en');
    assert.ok(result.metadata.keywords.includes('crawler'));
    assert.ok(result.metadata.estimatedTokens > 0, 'Estimated tokens should be > 0');
    assert.ok(result.markdown.startsWith('---'), 'Should have YAML frontmatter');
  });

  it('preserves lists, nested links, blockquotes, and inline formatting', () => {
    const formattingHtml = `
      <main>
        <blockquote>
          <p>The web is the world's largest knowledge base.</p>
        </blockquote>
        <ul>
          <li><strong>Zero Telemetry</strong>: No phone-home tracking.</li>
          <li><em>High Throughput</em>: Asynchronous concurrency.</li>
          <li><a href="https://github.com/nymrel/nymrel-crawler-mesh">GitHub Repo</a></li>
        </ul>
      </main>
    `;

    const result = extractMarkdown(formattingHtml);

    assert.ok(result.markdown.includes('> The web is the world\'s largest knowledge base.'));
    assert.ok(result.markdown.includes('- **Zero Telemetry**: No phone-home tracking.'));
    assert.ok(result.markdown.includes('- *High Throughput*: Asynchronous concurrency.'));
    assert.ok(result.markdown.includes('[GitHub Repo](https://github.com/nymrel/nymrel-crawler-mesh)'));
    assert.equal(result.links.length, 1);
    assert.equal(result.links[0].href, 'https://github.com/nymrel/nymrel-crawler-mesh');
  });
});
