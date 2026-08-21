"""
tests.test_extractor
Test suite for Python semantic HTML extractor
"""

import unittest
from nymrel_crawler_mesh.extractor import extract_markdown, extract_metadata, clean_html


class TestExtractor(unittest.TestCase):
    def test_strip_noise_and_extract_content(self):
        raw_html = """
        <!DOCTYPE html>
        <html>
          <head>
            <title>Python Extractor Test</title>
            <meta name="description" content="Test description">
          </head>
          <body>
            <header><nav><a href="/home">Home</a></nav></header>
            <div class="ad-container"><p>Ads</p></div>
            <div class="cookie-banner"><p>Cookies</p></div>
            <img src="/pixel.gif" width="1" height="1" alt="pixel" />
            <main>
              <h1>Clean Markdown Extraction</h1>
              <p>Extracting high fidelity content for AI agents.</p>
            </main>
            <footer><p>&copy; 2026</p></footer>
            <script>console.log("bad");</script>
          </body>
        </html>
        """
        result = extract_markdown(raw_html)
        self.assertIn("# Clean Markdown Extraction", result.markdown)
        self.assertIn("Extracting high fidelity content", result.markdown)
        self.assertNotIn("Home", result.markdown)
        self.assertNotIn("Ads", result.markdown)
        self.assertNotIn("Cookies", result.markdown)
        self.assertNotIn("console.log", result.markdown)
        self.assertEqual(result.metadata.title, "Python Extractor Test")

    def test_table_conversion(self):
        html_table = """
        <main>
          <table>
            <thead>
              <tr><th>Metric</th><th>Score</th></tr>
            </thead>
            <tbody>
              <tr><td>Precision</td><td>99.4%</td></tr>
              <tr><td>Recall</td><td>98.9%</td></tr>
            </tbody>
          </table>
        </main>
        """
        result = extract_markdown(html_table)
        self.assertIn("| Metric", result.markdown)
        self.assertIn("| Precision", result.markdown)
        self.assertEqual(len(result.tables), 1)
        self.assertEqual(result.tables[0].headers, ["Metric", "Score"])

    def test_code_block_preservation(self):
        html_code = """
        <main>
          <pre><code class="language-typescript">
const mesh = new CrawlerMesh();
await mesh.crawl('https://nymrel.com');
          </code></pre>
        </main>
        """
        result = extract_markdown(html_code)
        self.assertIn("```typescript", result.markdown)
        self.assertIn("const mesh = new CrawlerMesh();", result.markdown)
        self.assertEqual(len(result.code_blocks), 1)
        self.assertEqual(result.code_blocks[0].language, "typescript")

    def test_metadata_and_token_estimation(self):
        html_meta = """
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>AI Ingestion Engine</title>
            <meta name="description" content="A description">
            <meta name="author" content="Jalen">
            <meta property="og:title" content="AI Ingestion Engine">
            <meta property="og:url" content="https://nymrel.com/engine">
            <link rel="canonical" href="https://nymrel.com/engine">
          </head>
          <body>
            <main>
              <h1>AI Ingestion Engine</h1>
              <p>Zero-telemetry data extraction at scale.</p>
            </main>
          </body>
        </html>
        """
        result = extract_markdown(html_meta)
        self.assertEqual(result.metadata.title, "AI Ingestion Engine")
        self.assertEqual(result.metadata.canonical, "https://nymrel.com/engine")
        self.assertEqual(result.metadata.author, "Jalen")
        self.assertEqual(result.metadata.language, "en")
        self.assertTrue(result.metadata.estimated_tokens > 0)
        self.assertTrue(result.markdown.startswith("---"))


if __name__ == "__main__":
    unittest.main()
