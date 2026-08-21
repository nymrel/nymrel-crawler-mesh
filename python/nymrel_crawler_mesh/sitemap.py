"""
nymrel_crawler_mesh.sitemap
XML Sitemap & Sitemap Index Parser
Copyright (c) 2026 Nymrel / JalenBuilds LLC
"""

import re
import urllib.request
from typing import List, Optional
from xml.etree import ElementTree as ET

from .models import SitemapEntry, SitemapResult


def parse_sitemap_xml(xml_content: str) -> SitemapResult:
    result = SitemapResult()

    # 1. Check for sitemapindex
    if re.search(r"<sitemapindex\b", xml_content, re.IGNORECASE):
        sitemap_blocks = re.findall(r"<sitemap\b[^>]*>(.*?)</sitemap>", xml_content, re.IGNORECASE | re.DOTALL)
        for block in sitemap_blocks:
            loc_match = re.search(r"<loc\b[^>]*>(.*?)</loc>", block, re.IGNORECASE | re.DOTALL)
            if loc_match:
                loc = loc_match.group(1).strip()
                if loc and loc not in result.sitemaps:
                    result.sitemaps.append(loc)

    # 2. Check for urlset
    url_blocks = re.findall(r"<url\b[^>]*>(.*?)</url>", xml_content, re.IGNORECASE | re.DOTALL)
    for block in url_blocks:
        loc_match = re.search(r"<loc\b[^>]*>(.*?)</loc>", block, re.IGNORECASE | re.DOTALL)
        if not loc_match:
            continue

        loc = loc_match.group(1).strip()
        if not loc:
            continue

        lastmod_match = re.search(r"<lastmod\b[^>]*>(.*?)</lastmod>", block, re.IGNORECASE | re.DOTALL)
        changefreq_match = re.search(r"<changefreq\b[^>]*>(.*?)</changefreq>", block, re.IGNORECASE | re.DOTALL)
        priority_match = re.search(r"<priority\b[^>]*>(.*?)</priority>", block, re.IGNORECASE | re.DOTALL)

        priority = None
        if priority_match:
            try:
                priority = float(priority_match.group(1).strip())
            except ValueError:
                pass

        entry = SitemapEntry(
            loc=loc,
            lastmod=lastmod_match.group(1).strip() if lastmod_match else None,
            changefreq=changefreq_match.group(1).strip() if changefreq_match else None,
            priority=priority,
        )
        result.urls.append(entry)

    return result


def fetch_and_parse_sitemap(
    sitemap_url: str,
    user_agent: str = "NymrelCrawlerMesh/1.0 (+https://github.com/nymrel/nymrel-crawler-mesh)",
    timeout_sec: float = 15.0,
    max_depth: int = 2,
    current_depth: int = 0,
) -> SitemapResult:
    combined_result = SitemapResult()

    try:
        req = urllib.request.Request(
            sitemap_url,
            headers={
                "User-Agent": user_agent,
                "Accept": "application/xml, text/xml, */*",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            xml_content = resp.read().decode("utf-8", errors="replace")

        parsed = parse_sitemap_xml(xml_content)
        combined_result.urls.extend(parsed.urls)
        combined_result.sitemaps.extend(parsed.sitemaps)

        if parsed.sitemaps and current_depth < max_depth:
            for child_sitemap in parsed.sitemaps:
                child_res = fetch_and_parse_sitemap(
                    child_sitemap,
                    user_agent=user_agent,
                    timeout_sec=timeout_sec,
                    max_depth=max_depth,
                    current_depth=current_depth + 1,
                )
                combined_result.urls.extend(child_res.urls)
                combined_result.errors.extend(child_res.errors)

    except Exception as err:
        combined_result.errors.append(f"Failed to fetch {sitemap_url}: {str(err)}")

    return combined_result
