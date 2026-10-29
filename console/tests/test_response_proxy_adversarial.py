"""Adversarial stress harness for console/app.py proxy security and error handling.
Verifies:
1. POST without reason on reject strictly returns 400 (empty, whitespace, missing, null, non-string, malformed JSON).
2. Unconfigured proxy strictly returns 503 for all response action routes (GET, authorize, reject).
3. PANOPTICON_MANAGER_TOKEN is NEVER leaked in response headers or response body under any condition.
"""
import json
import os
import sys
import threading
import unittest
import unittest.mock
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import ManagerProxyError, build_server  # noqa: E402

CANARY_SECRET_TOKEN = "SUPER_SECRET_CANARY_TOKEN_987654321_DO_NOT_LEAK"


class ProxyAdversarialSecurityTests(unittest.TestCase):
    def _build(self, manager_url=None, manager_token=None):
        server = build_server(Path("unused.ndjson"), "127.0.0.1", 0, manager_url, manager_token)
        self.addCleanup(server.server_close)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(lambda: (server.shutdown(), thread.join(timeout=5)))
        return port

    def _request(self, port, path, method="GET", body=None, headers=None):
        req_headers = headers or {}
        req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", method=method, data=body, headers=req_headers)
        try:
            resp = urllib.request.urlopen(req, timeout=5)
            return resp.status, resp.read(), dict(resp.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), dict(e.headers)

    # -------------------------------------------------------------
    # CHALLENGE 2A: POST without reason on reject returns 400
    # -------------------------------------------------------------
    def test_reject_without_reason_variations_return_400(self):
        port = self._build(manager_url="http://127.0.0.1:8788", manager_token=CANARY_SECRET_TOKEN)

        adversarial_payloads = [
            None,  # No body at all
            b"",   # Empty bytes
            b"{}", # Missing reason key
            b'{"reason": ""}',  # Empty string
            b'{"reason": "   "}',  # Whitespace only
            b'{"reason": "\t\r\n"}',  # Whitespace variations
            b'{"reason": null}',  # Null reason
            b'{"reason": 12345}',  # Numeric reason
            b'{"reason": ["not", "string"]}',  # Array reason
            b'{"other": "field"}',  # Key name mismatch
            b'not valid json at all',  # Malformed JSON
        ]

        for payload in adversarial_payloads:
            headers = {"Content-Type": "application/json"} if payload is not None else {}
            status, body, _ = self._request(
                port, "/api/response-actions/ra-reject-test/reject", method="POST", body=payload, headers=headers
            )
            self.assertEqual(status, 400, f"Payload {payload} did not return 400, got {status}: {body.decode(errors='replace')}")
            self.assertIn(b"reason", body.lower())

    # -------------------------------------------------------------
    # CHALLENGE 2B: Unconfigured proxy returns 503
    # -------------------------------------------------------------
    def test_unconfigured_proxy_returns_503(self):
        test_configs = [
            (None, None),  # Neither configured
            ("http://127.0.0.1:8788", None),  # URL only, missing token
            (None, CANARY_SECRET_TOKEN),  # Token only, missing URL
            ("", ""),  # Empty strings
        ]

        for m_url, m_token in test_configs:
            port = self._build(manager_url=m_url, manager_token=m_token)

            # Test GET /api/response-actions
            status_get, body_get, _ = self._request(port, "/api/response-actions", method="GET")
            self.assertEqual(status_get, 503, f"GET should return 503 for config ({m_url}, {m_token})")

            # Test POST /api/response-actions/{id}/authorize
            status_auth, body_auth, _ = self._request(port, "/api/response-actions/ra-1/authorize", method="POST")
            self.assertEqual(status_auth, 503, f"POST authorize should return 503 for config ({m_url}, {m_token})")

            # Test POST /api/response-actions/{id}/reject
            status_rej, body_rej, _ = self._request(
                port, "/api/response-actions/ra-1/reject", method="POST", body=b'{"reason":"valid"}'
            )
            self.assertEqual(status_rej, 503, f"POST reject should return 503 for config ({m_url}, {m_token})")

    # -------------------------------------------------------------
    # CHALLENGE 2C: Token is NEVER in response body or headers
    # -------------------------------------------------------------
    def test_token_is_never_leaked_under_any_condition(self):
        port = self._build(manager_url="http://127.0.0.1:8788", manager_token=CANARY_SECRET_TOKEN)
        canary_bytes = CANARY_SECRET_TOKEN.encode("utf-8")

        def assert_no_leak(status_code, body, headers, scenario):
            self.assertNotIn(canary_bytes, body, f"Token leaked in body during scenario: {scenario}")
            for h_name, h_val in headers.items():
                self.assertNotIn(canary_bytes, h_name.encode("utf-8"), f"Token leaked in header name {h_name} during {scenario}")
                self.assertNotIn(canary_bytes, str(h_val).encode("utf-8"), f"Token leaked in header value for {h_name} during {scenario}")

        # Scenario 1: Successful GET
        with unittest.mock.patch("app.fetch_response_actions", return_value=(200, b'{"response_actions":[]}')):
            s, b, h = self._request(port, "/api/response-actions", "GET")
            self.assertEqual(s, 200)
            assert_no_leak(s, b, h, "Successful GET")

        # Scenario 2: Successful POST authorize
        with unittest.mock.patch("app.submit_response_action", return_value=(200, b'{"status":"authorized"}')):
            s, b, h = self._request(port, "/api/response-actions/r1/authorize", "POST")
            self.assertEqual(s, 200)
            assert_no_leak(s, b, h, "Successful POST authorize")

        # Scenario 3: Successful POST reject
        with unittest.mock.patch("app.submit_response_action", return_value=(200, b'{"status":"rejected"}')):
            s, b, h = self._request(port, "/api/response-actions/r1/reject", "POST", b'{"reason":"fine"}')
            self.assertEqual(s, 200)
            assert_no_leak(s, b, h, "Successful POST reject")

        # Scenario 4: 400 Bad Request (empty reject reason)
        s, b, h = self._request(port, "/api/response-actions/r1/reject", "POST", b'{"reason":""}')
        self.assertEqual(s, 400)
        assert_no_leak(s, b, h, "400 Bad Request")

        # Scenario 5: 401 Unauthorized from upstream
        with unittest.mock.patch("app.fetch_response_actions", return_value=(401, b'{"error":"invalid token"}')):
            s, b, h = self._request(port, "/api/response-actions", "GET")
            self.assertEqual(s, 401)
            assert_no_leak(s, b, h, "401 from upstream")

        # Scenario 6: 403 Forbidden from upstream
        with unittest.mock.patch("app.submit_response_action", return_value=(403, b'{"error":"forbidden"}')):
            s, b, h = self._request(port, "/api/response-actions/r1/authorize", "POST")
            self.assertEqual(s, 403)
            assert_no_leak(s, b, h, "403 from upstream")

        # Scenario 7: 502 Manager unreachable
        with unittest.mock.patch("app.fetch_response_actions", side_effect=ManagerProxyError("connection refused")):
            s, b, h = self._request(port, "/api/response-actions", "GET")
            self.assertEqual(s, 502)
            assert_no_leak(s, b, h, "502 Unreachable")

        # Scenario 8: 404 Not Found route
        s, b, h = self._request(port, "/api/response-actions/r1/invalid_action", "POST")
        self.assertEqual(s, 404)
        assert_no_leak(s, b, h, "404 Not Found route")


if __name__ == "__main__":
    unittest.main()
