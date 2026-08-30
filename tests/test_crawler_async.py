"""
tests.test_crawler_async
Event-loop offloading tests for CrawlerMesh robots.txt and sitemap I/O
Copyright (c) 2026 Nymrel / JalenBuilds LLC
"""

import asyncio
import threading
import time
import unittest
from unittest import mock

from nymrel_crawler_mesh.crawler import CrawlerMesh

BLOCK_SEC = 0.3   # controlled blocking delay inside fake network handlers
TICK_SEC = 0.005  # event-loop heartbeat interval
MIN_TICKS = 20    # ~0.1s of liveness; a loop-blocking implementation yields ~0-2

ROBOTS_ALLOW_ALL = "User-agent: *\nAllow: /\n"
SITEMAP_XML = (
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    "<url><loc>https://unit.test/s1</loc></url>"
    "<url><loc>https://unit.test/s2</loc></url>"
    "</urlset>"
)


class _FakeResponse:
    def __init__(self, body, content_type="text/html"):
        self.status = 200
        self.reason = "OK"
        self.headers = {"Content-Type": content_type}
        self._body = body.encode("utf-8")

    def items(self):
        return self.headers.items()

    def read(self, size=-1):
        return self._body if size is None or size < 0 else self._body[:size]

    def close(self):
        return None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeNet:
    """Deterministic local route table; never touches the real network.

    Handlers block their calling thread with time.sleep to simulate slow
    synchronous I/O, and every call records the URL plus serving thread id.
    """

    def __init__(self):
        self.routes = {}  # url suffix -> (delay_sec, body, content_type)
        self.fail_suffixes = set()
        self.calls = []  # (url, thread_id)
        self._lock = threading.Lock()

    def add(self, suffix, delay=0.0, body="", content_type="text/html"):
        self.routes[suffix] = (delay, body, content_type)

    def __call__(self, req, timeout=None):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        with self._lock:
            self.calls.append((url, threading.get_ident()))
        for suffix, (delay, body, content_type) in self.routes.items():
            if url.endswith(suffix):
                if suffix in self.fail_suffixes:
                    raise OSError(f"simulated failure for {url}")
                if delay:
                    time.sleep(delay)
                return _FakeResponse(body, content_type=content_type)
        raise AssertionError(f"unexpected URL requested: {url}")

    def calls_to(self, suffix):
        return [(url, tid) for url, tid in self.calls if url.endswith(suffix)]


async def _run_with_heartbeat(coro):
    """Run coro while a heartbeat task counts event-loop wakeups."""
    stop = asyncio.Event()
    ticks = 0

    async def heartbeat():
        nonlocal ticks
        while not stop.is_set():
            await asyncio.sleep(TICK_SEC)
            ticks += 1

    hb_task = asyncio.create_task(heartbeat())
    try:
        result = await coro
    finally:
        stop.set()
        await hb_task
    return result, ticks


class TestCrawlerAsyncIO(unittest.IsolatedAsyncioTestCase):
    async def test_robots_fetch_offloads_event_loop(self):
        net = _FakeNet()
        net.add("/robots.txt", delay=BLOCK_SEC, body=ROBOTS_ALLOW_ALL, content_type="text/plain")
        net.add("/page-a", body="<html><body>hi</body></html>")
        crawler = CrawlerMesh(cache=False, respect_robots=True, delay_ms=0, allow_private_networks=True, url_opener=net)

        with mock.patch("urllib.request.urlopen", net):
            result, ticks = await _run_with_heartbeat(
                crawler.crawl_url("https://unit.test/page-a")
            )

        # Loop stayed live while robots.txt blocked a worker thread.
        self.assertGreaterEqual(ticks, MIN_TICKS)
        # Robots fetch ran off the event-loop thread.
        robots_calls = net.calls_to("/robots.txt")
        self.assertEqual(len(robots_calls), 1)
        self.assertNotEqual(robots_calls[0][1], threading.get_ident())
        # Outcome preserved.
        self.assertEqual(result.url, "https://unit.test/page-a")
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.from_cache)

    async def test_sitemap_fetch_offloads_event_loop(self):
        net = _FakeNet()
        net.add("/sitemap.xml", delay=BLOCK_SEC, body=SITEMAP_XML, content_type="application/xml")
        net.add("/robots.txt", body=ROBOTS_ALLOW_ALL, content_type="text/plain")
        net.add("/home", body="<html><body>home</body></html>")
        net.add("/s1", body="<html><body>s1</body></html>")
        net.add("/s2", body="<html><body>s2</body></html>")
        crawler = CrawlerMesh(cache=False, include_sitemaps=True, max_pages=3, delay_ms=0, allow_private_networks=True, url_opener=net)

        with mock.patch("urllib.request.urlopen", net):
            summary, ticks = await _run_with_heartbeat(
                crawler.crawl(["https://unit.test/home"])
            )

        self.assertGreaterEqual(ticks, MIN_TICKS)
        sitemap_calls = net.calls_to("/sitemap.xml")
        self.assertEqual(len(sitemap_calls), 1)
        self.assertNotEqual(sitemap_calls[0][1], threading.get_ident())
        # Sitemap entries were queued and crawled alongside the start URL.
        self.assertEqual(summary.total_crawled, 3)
        self.assertEqual(summary.total_errors, 0)

    async def test_independent_origins_overlap(self):
        net = _FakeNet()
        empty_sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
        for host in ("alpha.test", "beta.test"):
            net.add(f"https://{host}/robots.txt", delay=BLOCK_SEC, body=ROBOTS_ALLOW_ALL, content_type="text/plain")
            net.add(f"https://{host}/sitemap.xml", delay=BLOCK_SEC, body=empty_sitemap, content_type="application/xml")
            net.add(f"https://{host}/home", body="<html><body>x</body></html>")
        crawler = CrawlerMesh(cache=False, include_sitemaps=True, max_pages=2, delay_ms=0, allow_private_networks=True, url_opener=net)

        start = time.perf_counter()
        with mock.patch("urllib.request.urlopen", net):
            summary = await crawler.crawl(
                ["https://alpha.test/home", "https://beta.test/home"]
            )
        elapsed = time.perf_counter() - start

        # Four blocking operations of BLOCK_SEC each (2 origins x robots+sitemap):
        # overlapped execution must finish far below their serial sum.
        serial_floor = BLOCK_SEC * 4
        self.assertLess(elapsed, serial_floor * 0.75)
        # Sanity: the controlled delays actually engaged.
        self.assertGreaterEqual(elapsed, BLOCK_SEC * 2 * 0.9)
        self.assertEqual(summary.total_crawled, 2)
        self.assertEqual(summary.total_errors, 0)
        # Exactly one robots + one sitemap fetch per origin (cache semantics).
        self.assertEqual(len(net.calls_to("/robots.txt")), 2)
        self.assertEqual(len(net.calls_to("/sitemap.xml")), 2)

    async def test_robots_semantics_preserved(self):
        net = _FakeNet()
        net.add(
            "/robots.txt",
            body="User-agent: *\nDisallow: /private\nCrawl-delay: 0.1\n",
            content_type="text/plain",
        )
        net.add("/public-page", body="<html><body>ok</body></html>")
        crawler = CrawlerMesh(cache=False, delay_ms=0, allow_private_networks=True, url_opener=net)

        with mock.patch("urllib.request.urlopen", net):
            with self.assertRaises(PermissionError):
                await crawler.crawl_url("https://rules.test/private/x")
            result = await crawler.crawl_url("https://rules.test/public-page")

        self.assertEqual(result.status_code, 200)
        # Crawl-delay propagated into the rate limiter.
        state = crawler.rate_limiter.domain_states.get("rules.test")
        self.assertIsNotNone(state)
        self.assertAlmostEqual(state.delay_sec, 0.1)
        # Robots fetched exactly once across both calls (cache hit second time).
        self.assertEqual(len(net.calls_to("/robots.txt")), 1)

    async def test_fail_soft_on_robots_and_sitemap_errors(self):
        # A raising robots fetch must degrade to an allow-all parser.
        net = _FakeNet()
        net.add("/robots.txt", body=ROBOTS_ALLOW_ALL, content_type="text/plain")
        net.add("/page-b", body="<html><body>b</body></html>")
        net.fail_suffixes.add("/robots.txt")
        crawler = CrawlerMesh(cache=False, delay_ms=0, allow_private_networks=True, url_opener=net)

        with mock.patch("urllib.request.urlopen", net):
            result = await crawler.crawl_url("https://soft.test/page-b")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(net.calls_to("/robots.txt")), 1)

        # A raising sitemap job must not break the crawl.
        def boom(*args, **kwargs):
            raise RuntimeError("simulated sitemap failure")

        net2 = _FakeNet()
        net2.add("/robots.txt", body=ROBOTS_ALLOW_ALL, content_type="text/plain")
        net2.add("/home", body="<html><body>home</body></html>")
        crawler2 = CrawlerMesh(cache=False, include_sitemaps=True, max_pages=1, delay_ms=0, allow_private_networks=True, url_opener=net2)

        with mock.patch("nymrel_crawler_mesh.crawler.fetch_and_parse_sitemap", boom):
            with mock.patch("urllib.request.urlopen", net2):
                summary = await crawler2.crawl(["https://soft.test/home"])
        self.assertEqual(summary.total_crawled, 1)
        self.assertEqual(summary.total_errors, 0)


if __name__ == "__main__":
    unittest.main()
