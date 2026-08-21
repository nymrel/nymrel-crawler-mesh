"""
tests.test_cli
Test suite for Python CLI driver
"""

import os
import unittest
from nymrel_crawler_mesh.cli import main


class TestCLI(unittest.TestCase):
    def test_cli_extract_file(self):
        temp_html = os.path.abspath(".test_cli_page.html")
        temp_out = os.path.abspath(".test_cli_out.md")

        with open(temp_html, "w", encoding="utf-8") as f:
            f.write("<html><body><main><h1>CLI Header</h1><p>Content</p></main></body></html>")

        try:
            main(["extract", temp_html, "--output", temp_out])
            self.assertTrue(os.path.exists(temp_out))
            with open(temp_out, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("# CLI Header", content)
            self.assertIn("Content", content)
        finally:
            if os.path.exists(temp_html):
                os.remove(temp_html)
            if os.path.exists(temp_out):
                os.remove(temp_out)


if __name__ == "__main__":
    unittest.main()
