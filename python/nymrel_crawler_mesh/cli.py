"""
nymrel_crawler_mesh.cli
CLI Driver for Python
Copyright (c) 2026 Nymrel / JalenBuilds LLC
"""

import argparse
import asyncio
import json
import os
import sys
from typing import List, Optional

from .crawler import CrawlerMesh
from .extractor import extract_markdown
from .sitemap import fetch_and_parse_sitemap, parse_sitemap_xml
from .network_policy import NetworkPolicy, fetch_http_text

VERSION = "1.0.0"


def print_banner() -> None:
    print(
        f"\033[1m\033[36mnymrel-crawler-mesh (Python Engine)\033[0m v{VERSION}\n"
        "Bounded, Zero-Telemetry HTTP Crawler & Markdown/JSON Extractor\n"
    )


def handle_crawl(args: argparse.Namespace) -> int:
    if not args.silent:
        print_banner()
        print(f"Target URL:     {args.url}")
        print(f"Max Depth:      {args.max_depth} | Max Pages: {args.max_pages} | Concurrency: {args.concurrency}")
        print(f"Cache:          {'Disabled' if args.no_cache else 'Enabled (.crawler-cache)'}")
        print(f"Robots.txt:     {'Ignored' if args.ignore_robots else 'Enforced'}\n")

    mesh = CrawlerMesh(
        max_depth=args.max_depth,
        max_pages=args.max_pages,
        max_concurrency=args.concurrency,
        delay_ms=args.delay,
        cache=not args.no_cache,
        respect_robots=not args.ignore_robots,
        user_agent=args.user_agent,
        include_sitemaps=args.sitemaps,
        allow_private_networks=args.allow_private_networks,
    )

    def on_page_cb(res):
        if not args.silent:
            tag = "\033[33m[CACHE]\033[0m" if res.from_cache else "\033[32m[FETCH]\033[0m"
            print(f"{tag} ({res.status_code}) [Depth {res.depth}] {res.url} - {res.metadata.title or 'Untitled'} ({res.metadata.estimated_tokens} tokens)")

    summary = asyncio.run(mesh.crawl(args.url, on_page=on_page_cb))

    if args.output:
        os.makedirs(args.output, exist_ok=True)
        for i, res in enumerate(summary.results):
            safe_title = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in (res.metadata.title or "doc"))[:40]
            ext = ".json" if args.format == "json" else ".md"
            file_path = os.path.join(args.output, f"page_{i+1}_{safe_title}{ext}")
            if args.format == "json":
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(res.__dict__, f, indent=2, default=str)
            else:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(res.markdown)

        if not args.silent:
            print(f"\n\033[32mSaved {len(summary.results)} extracted files to {args.output}\033[0m")

    if not args.silent:
        print("\n\033[1m\033[36m=== Crawl Completed ===\033[0m")
        print(f"Total Crawled:  {summary.total_crawled}")
        print(f"Cache Hits:     {summary.total_cached}")
        print(f"Errors:         {summary.total_errors}")
        print(f"Duration:       {summary.duration_ms / 1000.0:.2f}s")

    return 0 if summary.total_crawled > 0 or summary.total_errors == 0 else 1


def handle_extract(args: argparse.Namespace) -> int:
    target = args.target
    raw_html = ""
    base_url = ""

    if target == "-":
        raw_html = sys.stdin.read()
    elif target.startswith("http://") or target.startswith("https://"):
        base_url = target
        try:
            document = fetch_http_text(
                target,
                headers={"User-Agent": "NymrelCrawlerMesh/1.0 AI Data Engine"},
                policy=NetworkPolicy(allow_private_networks=args.allow_private_networks),
            )
            if not 200 <= document.status < 300:
                print(f"Remote extraction failed: HTTP {document.status}", file=sys.stderr)
                return 1
            base_url = document.final_url
            raw_html = document.text
        except Exception as e:
            print(f"Remote extraction failed: {type(e).__name__}", file=sys.stderr)
            return 1
    else:
        try:
            with open(target, "r", encoding="utf-8") as f:
                raw_html = f.read()
        except Exception as e:
            print(f"Error reading file {target}: {e}", file=sys.stderr)
            return 1

    extraction = extract_markdown(
        raw_html,
        base_url=base_url,
        include_frontmatter=not args.no_frontmatter,
        strip_links=args.strip_links,
        strip_images=args.strip_images,
    )

    if args.format == "json":
        output_content = json.dumps(extraction.__dict__, indent=2, default=str)
    else:
        output_content = extraction.markdown

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_content)
        print(f"Wrote extracted content to {args.output}")
    else:
        print(output_content)

    return 0


def handle_sitemap(args: argparse.Namespace) -> int:
    url = args.url
    if url.startswith("http://") or url.startswith("https://"):
        result = fetch_and_parse_sitemap(
            url,
            policy=NetworkPolicy(allow_private_networks=args.allow_private_networks),
        )
    else:
        with open(url, "r", encoding="utf-8") as f:
            result = parse_sitemap_xml(f.read())

    print("\033[1m\033[36m=== Sitemap Parsing Result ===\033[0m")
    print(f"Total URLs found:      {len(result.urls)}")
    print(f"Child Sitemaps found:  {len(result.sitemaps)}")

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result.__dict__, f, indent=2, default=str)
        print(f"Saved sitemap results to {args.output}")
    elif not args.crawl:
        for entry in result.urls[:30]:
            print(f" - {entry.loc}")
        if len(result.urls) > 30:
            print(f" ... and {len(result.urls) - 30} more")

    if args.crawl and result.urls:
        urls = [u.loc for u in result.urls]
        print(f"\nLaunching crawler mesh on {len(urls)} sitemap URLs...")
        mesh = CrawlerMesh(allow_private_networks=args.allow_private_networks)
        summary = asyncio.run(mesh.crawl(urls))
        print(f"Finished crawling sitemap URLs. Total crawled: {summary.total_crawled}")

    return 0


def handle_bench(args: argparse.Namespace) -> int:
    print_banner()
    print(f"Target:      {args.url}")
    print(f"Requests:    {args.requests} total requests")
    print(f"Concurrency: {args.concurrency} parallel workers\n")

    mesh = CrawlerMesh(allow_private_networks=args.allow_private_networks)
    bench = asyncio.run(mesh.benchmark(args.url, count=args.requests, concurrency=args.concurrency))

    print("\033[1m\033[32m=== Benchmark Results ===\033[0m")
    print(f"Throughput:             \033[1m{bench.requests_per_second} req/sec\033[0m")
    print(f"Successful Requests:    {bench.successful_requests} / {bench.total_requests}")
    print(f"Total Duration:         {bench.total_duration_ms / 1000.0:.2f}s")
    print(f"Avg Latency:            {bench.avg_latency_ms} ms")
    print(f"Min / Max Latency:      {bench.min_latency_ms} ms / {bench.max_latency_ms} ms")
    print(f"P95 Latency:            {bench.p95_latency_ms} ms")
    print(f"Avg Markdown Parsing:   {bench.avg_markdown_extraction_ms} ms")
    print(f"Cache Hit Rate:         {bench.cache_hit_rate} %")
    print(f"Total Bytes:            {bench.total_bytes_downloaded / 1024.0:.2f} KB")

    return 0


def main(argv: Optional[List[str]] = None) -> None:
    if argv is None:
        argv = sys.argv[1:]

    parser = argparse.ArgumentParser(
        prog="crawler-mesh-py",
        description="nymrel-crawler-mesh: bounded, zero-telemetry HTTP crawler and Markdown extractor",
    )
    parser.add_argument("-v", "--version", action="version", version=f"%(prog)s {VERSION}")

    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # crawl
    p_crawl = subparsers.add_parser("crawl", help="Crawl a URL or entire site recursively")
    p_crawl.add_argument("url", help="Target URL to start crawling")
    p_crawl.add_argument("--max-depth", type=int, default=2, help="Max depth")
    p_crawl.add_argument("--max-pages", type=int, default=20, help="Max pages")
    p_crawl.add_argument("--concurrency", type=int, default=5, help="Concurrency")
    p_crawl.add_argument("--delay", type=int, default=250, help="Delay in ms")
    p_crawl.add_argument("--output", help="Directory for extracted files")
    p_crawl.add_argument("--format", choices=["md", "json"], default="md", help="Output format")
    p_crawl.add_argument("--no-cache", action="store_true", help="Disable caching")
    p_crawl.add_argument("--ignore-robots", action="store_true", help="Ignore robots.txt")
    p_crawl.add_argument("--user-agent", default="NymrelCrawlerMesh/1.0", help="User Agent")
    p_crawl.add_argument("--sitemaps", action="store_true", help="Ingest sitemaps")
    p_crawl.add_argument("--silent", action="store_true", help="Suppress logs")
    p_crawl.add_argument("--allow-private-networks", action="store_true", help="Opt in to loopback/private network targets")

    # extract
    p_extract = subparsers.add_parser("extract", help="Extract Markdown/JSON from URL, file, or stdin (-)")
    p_extract.add_argument("target", help="URL, local HTML file, or - for stdin")
    p_extract.add_argument("--format", choices=["md", "json"], default="md", help="Output format")
    p_extract.add_argument("--no-frontmatter", action="store_true", help="Omit frontmatter")
    p_extract.add_argument("--strip-links", action="store_true", help="Remove hyperlinks")
    p_extract.add_argument("--strip-images", action="store_true", help="Remove images")
    p_extract.add_argument("--output", help="Write result to file")
    p_extract.add_argument("--allow-private-networks", action="store_true", help="Opt in to loopback/private network targets")

    # sitemap
    p_sitemap = subparsers.add_parser("sitemap", help="Parse XML sitemap or sitemap index")
    p_sitemap.add_argument("url", help="Sitemap URL or local XML file")
    p_sitemap.add_argument("--crawl", action="store_true", help="Immediately crawl URLs")
    p_sitemap.add_argument("--output", help="Save URLs to JSON file")
    p_sitemap.add_argument("--allow-private-networks", action="store_true", help="Opt in to loopback/private network targets")

    # bench
    p_bench = subparsers.add_parser("bench", help="Run a bounded request benchmark")
    p_bench.add_argument("url", help="Target URL")
    p_bench.add_argument("--requests", type=int, default=20, help="Total requests")
    p_bench.add_argument("--concurrency", type=int, default=5, help="Concurrency pool")
    p_bench.add_argument("--allow-private-networks", action="store_true", help="Opt in to loopback/private network targets")

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    if args.command == "crawl":
        return handle_crawl(args)
    elif args.command == "extract":
        return handle_extract(args)
    elif args.command == "sitemap":
        return handle_sitemap(args)
    elif args.command == "bench":
        return handle_bench(args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
