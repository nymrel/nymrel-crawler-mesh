"""
tests.test_cache
Test suite for Python ContentCache
"""

import os
import shutil
import unittest
from nymrel_crawler_mesh.cache import ContentCache, compute_sha256, normalize_url_key


class TestCache(unittest.TestCase):
    def setUp(self):
        self.test_cache_dir = os.path.abspath(".test-py-cache")
        self.cache = ContentCache(cache_dir=self.test_cache_dir, ttl_seconds=3600)

    def tearDown(self):
        if os.path.exists(self.test_cache_dir):
            shutil.rmtree(self.test_cache_dir, ignore_errors=True)

    def test_url_normalization(self):
        u1 = "https://Nymrel.com/test?utm_campaign=launch&a=1&b=2#hash"
        u2 = "https://nymrel.com/test?b=2&a=1"
        self.assertEqual(normalize_url_key(u1), normalize_url_key(u2))

    def test_sha256_computation(self):
        h1 = compute_sha256("test")
        h2 = compute_sha256("test")
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)

    def test_cache_set_and_get(self):
        url = "https://nymrel.com/api/v1"
        data = {
            "status_code": 200,
            "status_text": "OK",
            "html": "<h1>Test</h1>",
            "markdown": "# Test",
            "text": "Test",
            "metadata": {"title": "Test"},
            "etag": '"abc-123"',
        }
        self.cache.set(url, data)
        self.assertTrue(self.cache.has(url))

        retrieved = self.cache.get(url)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["markdown"], "# Test")
        self.assertEqual(retrieved["etag"], '"abc-123"')

        cond_headers = self.cache.get_conditional_headers(url)
        self.assertEqual(cond_headers.get("If-None-Match"), '"abc-123"')


if __name__ == "__main__":
    unittest.main()
