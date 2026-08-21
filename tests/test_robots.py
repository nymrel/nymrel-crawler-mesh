"""
tests.test_robots
Test suite for Python RobotsParser
"""

import unittest
from nymrel_crawler_mesh.robots import RobotsParser


class TestRobotsParser(unittest.TestCase):
    def setUp(self):
        self.robots_txt = """
        User-agent: *
        Disallow: /private/
        Allow: /private/public.html
        Disallow: /*.zip$
        Crawl-delay: 1.5
        Sitemap: https://nymrel.com/sitemap.xml

        User-agent: GPTBot
        Disallow: /no-gpt/
        Allow: /
        """
        self.parser = RobotsParser(self.robots_txt)

    def test_wildcard_user_agent_rules(self):
        self.assertTrue(self.parser.is_allowed("https://example.com/blog/post", "*"))
        self.assertFalse(self.parser.is_allowed("https://example.com/private/secret", "*"))
        # Specificity: longer allow should win
        self.assertTrue(self.parser.is_allowed("https://example.com/private/public.html", "*"))
        # Suffix matching
        self.assertFalse(self.parser.is_allowed("https://example.com/download/file.zip", "*"))
        self.assertTrue(self.parser.is_allowed("https://example.com/download/file.zip.txt", "*"))

    def test_specific_user_agent_rules(self):
        self.assertFalse(self.parser.is_allowed("https://example.com/no-gpt/doc", "GPTBot"))
        self.assertTrue(self.parser.is_allowed("https://example.com/private/other", "GPTBot"))

    def test_crawl_delay_and_sitemaps(self):
        self.assertEqual(self.parser.get_crawl_delay("*"), 1.5)
        self.assertIn("https://nymrel.com/sitemap.xml", self.parser.get_sitemaps())


if __name__ == "__main__":
    unittest.main()
