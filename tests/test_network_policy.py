"""Deterministic tests for the fail-closed outbound HTTP boundary."""

import unittest

from nymrel_crawler_mesh.network_policy import (
    CrawlerSecurityError,
    NetworkPolicy,
    fetch_http_text,
)


class _Response:
    def __init__(self, body=b"", status=200, headers=None):
        self.status = status
        self.reason = "OK"
        self.headers = headers or {}
        self._body = body
        self.closed = False

    def read(self, size=-1):
        return self._body if size is None or size < 0 else self._body[:size]

    def close(self):
        self.closed = True


class TestNetworkPolicy(unittest.TestCase):
    def test_rejects_non_http_credentials_and_private_targets(self):
        policy = NetworkPolicy(resolver=lambda _host: ["93.184.216.34"])
        with self.assertRaisesRegex(CrawlerSecurityError, "INVALID_URL"):
            policy.validate_url("file:///etc/passwd")
        with self.assertRaisesRegex(CrawlerSecurityError, "UNSAFE_URL_CREDENTIALS"):
            policy.validate_url("https://user:secret@example.test")

        private_policy = NetworkPolicy(resolver=lambda _host: ["10.2.3.4"])
        with self.assertRaisesRegex(CrawlerSecurityError, "PRIVATE_NETWORK_TARGET"):
            private_policy.validate_url("https://example.test")
        with self.assertRaisesRegex(CrawlerSecurityError, "PRIVATE_NETWORK_TARGET"):
            policy.validate_url("http://127.0.0.1/admin")

    def test_private_network_opt_in_is_explicit(self):
        policy = NetworkPolicy(allow_private_networks=True)
        self.assertEqual(policy.validate_url("http://127.0.0.1/health"), "http://127.0.0.1/health")
        with self.assertRaisesRegex(CrawlerSecurityError, "INVALID_URL"):
            policy.validate_url("file:///tmp/data")

    def test_redirect_target_is_validated_before_second_request(self):
        calls = []

        def opener(request, timeout=None):
            calls.append(request.full_url)
            return _Response(status=302, headers={"Location": "http://127.0.0.1/internal"})

        policy = NetworkPolicy(resolver=lambda _host: ["93.184.216.34"])
        with self.assertRaisesRegex(CrawlerSecurityError, "PRIVATE_NETWORK_TARGET"):
            fetch_http_text("https://public.test", policy=policy, opener=opener)
        self.assertEqual(calls, ["https://public.test"])

    def test_body_limit_is_enforced_and_response_is_closed(self):
        response = _Response(body=b"12345")

        def opener(request, timeout=None):
            return response

        policy = NetworkPolicy(
            max_response_bytes=4,
            resolver=lambda _host: ["93.184.216.34"],
        )
        with self.assertRaisesRegex(CrawlerSecurityError, "RESPONSE_TOO_LARGE"):
            fetch_http_text("https://public.test", policy=policy, opener=opener)
        self.assertTrue(response.closed)


if __name__ == "__main__":
    unittest.main()
