"""Deterministic tests for the fail-closed outbound HTTP boundary."""

import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

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


class _PinnedHandler(BaseHTTPRequestHandler):
    received_hosts = []

    def do_GET(self):
        self.received_hosts.append(self.headers.get("Host"))
        if self.path == "/start":
            self.send_response(302)
            self.send_header("Location", f"http://second.invalid:{self.server.server_port}/final")
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"validated-address-only")

    def log_message(self, _format, *args):
        return None


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

    def test_cross_scheme_redirect_strips_sensitive_and_host_headers(self):
        requests = []

        def opener(request, timeout=None):
            requests.append(dict(request.header_items()))
            if len(requests) == 1:
                return _Response(
                    status=302,
                    headers={"Location": "http://public.test/final"},
                )
            return _Response(body=b"ok")

        document = fetch_http_text(
            "https://public.test/start",
            headers={
                "Authorization": "Bearer secret",
                "Cookie": "session=secret",
                "Host": "attacker.invalid",
            },
            policy=NetworkPolicy(resolver=lambda _host: ["93.184.216.34"]),
            opener=opener,
        )

        self.assertEqual(document.text, "ok")
        normalized_first = {key.lower(): value for key, value in requests[0].items()}
        normalized_second = {key.lower(): value for key, value in requests[1].items()}
        self.assertNotIn("host", normalized_first)
        self.assertNotIn("authorization", normalized_second)
        self.assertNotIn("cookie", normalized_second)

    def test_connections_and_redirects_use_only_validated_addresses(self):
        _PinnedHandler.received_hosts = []
        server = ThreadingHTTPServer(("127.0.0.1", 0), _PinnedHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        resolved_hosts = []

        def resolver(hostname):
            resolved_hosts.append(hostname)
            return ["127.0.0.1"]

        try:
            document = fetch_http_text(
                f"http://first.invalid:{server.server_port}/start",
                policy=NetworkPolicy(
                    allow_private_networks=True,
                    resolver=resolver,
                ),
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

        self.assertEqual(document.text, "validated-address-only")
        self.assertEqual(
            document.final_url,
            f"http://second.invalid:{server.server_port}/final",
        )
        self.assertEqual(resolved_hosts, ["first.invalid", "second.invalid"])
        self.assertEqual(
            _PinnedHandler.received_hosts,
            [
                f"first.invalid:{server.server_port}",
                f"second.invalid:{server.server_port}",
            ],
        )

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
