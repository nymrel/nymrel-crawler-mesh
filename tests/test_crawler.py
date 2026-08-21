"""
tests.test_crawler
Test suite for Python CrawlerMesh and CrawlQueue
"""

import unittest
from nymrel_crawler_mesh.crawler import CrawlerMesh
from nymrel_crawler_mesh.queue import CrawlQueue, QueueItem, is_url_allowed
from nymrel_crawler_mesh.sitemap import parse_sitemap_xml


class TestCrawler(unittest.TestCase):
    def test_url_filtering(self):
        self.assertTrue(is_url_allowed("https://nymrel.com/docs", ["nymrel.com"], "same-domain"))
        self.assertTrue(is_url_allowed("https://sub.nymrel.com/docs", ["nymrel.com"], "subdomains"))
        self.assertFalse(is_url_allowed("https://other.com/docs", ["nymrel.com"], "same-domain"))
        self.assertFalse(is_url_allowed("https://nymrel.com/image.png", ["nymrel.com"]))

    def test_queue_deduplication(self):
        queue = CrawlQueue(start_domains=["nymrel.com"], max_depth=2)
        added1 = queue.enqueue(QueueItem(url="https://nymrel.com/page1", depth=0))
        added2 = queue.enqueue(QueueItem(url="https://nymrel.com/page1", depth=1))
        self.assertTrue(added1)
        self.assertFalse(added2)
        self.assertEqual(queue.size(), 1)

    def test_sitemap_xml_parsing(self):
        xml_str = """
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://nymrel.com/page1</loc>
            <lastmod>2026-08-21</lastmod>
            <priority>1.0</priority>
          </url>
        </urlset>
        """
        res = parse_sitemap_xml(xml_str)
        self.assertEqual(len(res.urls), 1)
        self.assertEqual(res.urls[0].loc, "https://nymrel.com/page1")
        self.assertEqual(res.urls[0].priority, 1.0)


if __name__ == "__main__":
    unittest.main()
