# nymrel-crawler-mesh

`nymrel-crawler-mesh` is a zero-telemetry HTTP crawler and HTML-to-Markdown/JSON extractor with TypeScript and Python engines. It is designed for bounded agent, indexing, and document-processing workflows where callers need explicit request limits and inspectable local behavior.

## Distribution status

This repository is currently the distribution source of truth. As of 2026-08-29, neither `@nymrel/crawler-mesh` on npm nor `nymrel-crawler-mesh` on PyPI has a public registry release. Do not treat the install names as registry availability until a release receipt exists.

Supported source runtimes:

- Node.js 22, 24, and 26; the local default is Node.js 24.
- Python 3.11, 3.12, 3.13, and 3.14; the local default is Python 3.13.
- TypeScript 7 for builds and type checking.

## What it does

- Crawls one page or a bounded same-domain queue with explicit depth, page, and concurrency limits.
- Applies per-domain delay and backoff behavior.
- Reads `robots.txt` by default and can ingest bounded sitemap trees.
- Extracts headings, metadata, links, images, tables, code blocks, text, and Markdown.
- Uses an optional filesystem content cache with SHA-256 content hashes.
- Emits no analytics, usage telemetry, or Nymrel service calls.

The two engines expose similar core behavior, but exact byte-for-byte feature parity is not promised. The tests define each runtime's supported contract.

## Network safety defaults

All crawler-controlled remote reads—including page, `robots.txt`, sitemap, CLI extraction, and redirects—share a fail-closed outbound policy:

- only `http:` and `https:` URLs are accepted;
- credentials embedded in URLs are rejected;
- every resolved address and redirect destination must be globally reachable by default;
- response bodies are limited to 10 MiB by default;
- redirect traversal is limited to five hops by default;
- sensitive request headers are removed on cross-origin redirects.

Private, loopback, link-local, and other non-global targets require an explicit opt-in:

```typescript
const mesh = new CrawlerMesh({ allowPrivateNetworks: true });
```

```python
mesh = CrawlerMesh(allow_private_networks=True)
```

```bash
crawler-mesh crawl http://127.0.0.1:8080 --allow-private-networks
crawler-mesh-py crawl http://127.0.0.1:8080 --allow-private-networks
```

This URL and DNS preflight is a guardrail, not a network sandbox. DNS can change between validation and connection, and a custom resolver or fetch implementation becomes part of the caller's trust boundary. For hostile or multi-tenant inputs, also enforce outbound firewall/proxy policy, run with least privilege, isolate cache/output directories, and deny metadata-service and control-plane routes at the network layer.

Respect site terms, access controls, privacy requirements, and crawling policy. `robots.txt` handling is useful coordination behavior; it is not authorization.

## Source setup

Clone the repository, then install locked Node development dependencies without lifecycle scripts:

```bash
git clone https://github.com/nymrel/nymrel-crawler-mesh.git
cd nymrel-crawler-mesh
npm ci --ignore-scripts
npm run check
```

Install the Python package from the local checkout with a PEP 517 frontend:

```bash
python -m pip install .
```

For local Python test execution without installing the project, place `python/` on `PYTHONPATH`:

```powershell
$env:PYTHONPATH = (Resolve-Path '.\python').Path
python -m unittest discover -s tests -p 'test_*.py' -v
```

## TypeScript API

```typescript
import { CrawlerMesh, crawlUrl, extractMarkdown } from '@nymrel/crawler-mesh';

const single = await crawlUrl('https://example.com/docs');
console.log(single.metadata.title, single.markdown);

const mesh = new CrawlerMesh({
  maxDepth: 2,
  maxPages: 50,
  maxConcurrency: 5,
  delayMs: 250,
  timeoutMs: 15_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRedirects: 5,
  cache: true,
  respectRobots: true,
  includeSitemaps: true,
  domainMatchMode: 'same-domain'
});

mesh.on('page', result => {
  console.log(result.statusCode, result.url, result.metadata.title);
});

const summary = await mesh.crawl('https://example.com');
console.log(summary.totalCrawled, summary.totalErrors);

const local = extractMarkdown('<main><h1>Hello</h1></main>');
console.log(local.markdown);
```

`resolveHostname` and `fetch` can be supplied for deterministic tests or controlled runtimes. Treat both as trusted policy dependencies.

## Python API

```python
import asyncio

from nymrel_crawler_mesh import CrawlerMesh, extract_markdown


async def main() -> None:
    mesh = CrawlerMesh(
        max_depth=2,
        max_pages=50,
        max_concurrency=5,
        delay_ms=250,
        timeout_sec=15,
        max_response_bytes=10 * 1024 * 1024,
        max_redirects=5,
        cache=True,
        respect_robots=True,
        include_sitemaps=True,
    )
    summary = await mesh.crawl('https://example.com')
    print(summary.total_crawled, summary.total_errors)


asyncio.run(main())

local = extract_markdown('<main><h1>Hello</h1></main>')
print(local.markdown)
```

The Python engine keeps synchronous network, cache, and extraction work off the event loop. A caller-provided resolver or URL opener is trusted infrastructure and should be deterministic in tests.

## CLI

After building or installing from source:

```bash
crawler-mesh --help
crawler-mesh crawl https://example.com --max-depth 2 --max-pages 50 --output ./crawled
crawler-mesh extract https://example.com/article --format md
crawler-mesh sitemap https://example.com/sitemap.xml --output sitemap.json
crawler-mesh bench https://example.com --requests 20 --concurrency 5

crawler-mesh-py crawl https://example.com --max-depth 2 --max-pages 50
crawler-mesh-py extract https://example.com/article --format md
```

Local HTML files and stdin extraction do not make remote requests.

## Verification

```bash
npm run check
npm audit --audit-level=high
npm pack --dry-run --ignore-scripts
```

```powershell
$env:PYTHONPATH = (Resolve-Path '.\python').Path
python -m unittest discover -s tests -p 'test_*.py' -v
```

CI runs Node.js 22/24/26 and Python 3.11-3.14. Release workflows build immutable npm, wheel, and source archives, record SHA-256 checksums, and attest tag-built artifacts. Actual registry publication remains gated on tag identity plus npm/PyPI trusted-publisher and GitHub environment configuration.

## Privacy and limitations

The project does not add telemetry. Crawling still sends normal HTTP requests to the selected targets, and filesystem caching stores fetched content locally. Disable caching when local persistence is inappropriate.

The extractor is intentionally lightweight and does not execute JavaScript. It is not a browser, login automation system, anti-bot bypass, malware scanner, HTML sanitizer for later browser rendering, or proof that content is safe to trust. Large or adversarial documents should be processed in an isolated runtime with additional CPU, memory, disk, and network limits.

## Project metadata

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  "name": "nymrel-crawler-mesh",
  "codeRepository": "https://github.com/nymrel/nymrel-crawler-mesh",
  "author": {
    "@type": "Organization",
    "name": "Nymrel",
    "url": "https://nymrel.com"
  },
  "license": "https://opensource.org/licenses/MIT",
  "programmingLanguage": ["TypeScript", "Python"],
  "applicationCategory": "DeveloperApplication"
}
```

## Security and license

See [SECURITY.md](SECURITY.md) for the security model and private reporting route. The project is distributed under the [MIT License](LICENSE).
