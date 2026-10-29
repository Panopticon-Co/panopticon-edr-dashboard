/**
 * Mock Console Proxy Server implementing PROJECT.md Section 3 Contracts
 * Emulates Python console/app.py reverse proxy for standalone E2E validation
 */
const http = require('node:http');
const config = require('../config');

class MockProxyServer {
  constructor(port = config.PROXY_PORT, backendUrl = config.BACKEND_BASE_URL, token = config.MANAGER_TOKEN) {
    this.port = port;
    this.backendUrl = backendUrl;
    this.token = token;
    this.server = null;
    this.alerts = [];
  }

  setBackendUrl(url) {
    this.backendUrl = url;
  }

  setToken(token) {
    this.token = token;
  }

  setAlerts(alerts) {
    this.alerts = alerts;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${this.port}`);
        const pathname = url.pathname;
        const method = req.method;

        const sendJson = (status, obj) => {
          const body = Buffer.from(JSON.stringify(obj), 'utf8');
          res.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': body.length,
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
          });
          res.end(body);
        };

        // Static routes
        if (pathname === '/api/alerts') {
          return sendJson(200, this.alerts);
        }
        if (pathname === '/api/stats') {
          if (this.backendUrl) {
            try {
              const bRes = await fetch(`${this.backendUrl.replace(/\/+$/, '')}/api/v1/stats`);
              const bJson = await bRes.json();
              return sendJson(bRes.status, bJson);
            } catch (err) {}
          }
          const counts = { total: this.alerts.length, critical: 0, high: 0, medium: 0, low: 0, info: 0, hosts_alerting: 0 };
          const hosts = new Set();
          for (const a of this.alerts) {
            const s = String(a.severity || 'info').toLowerCase();
            if (counts[s] !== undefined) counts[s]++;
            const h = a.host_id || (a.evidence && a.evidence['host.id']);
            if (h) hosts.add(h);
          }
          counts.hosts_alerting = hosts.size;
          return sendJson(200, counts);
        }

        // Response actions proxying
        if (pathname === '/api/response-actions' && method === 'GET') {
          if (!this.backendUrl || !this.token) {
            return sendJson(503, { error: 'Manager connection not configured' });
          }
          try {
            const targetUrl = `${this.backendUrl.replace(/\/+$/, '')}/api/v1/response-actions`;
            const bRes = await fetch(targetUrl, {
              headers: { Authorization: `Bearer ${this.token}` },
            });
            const data = await bRes.json();
            return sendJson(bRes.status, data);
          } catch (err) {
            return sendJson(502, { error: `could not reach Manager: ${err.message}` });
          }
        }

        // Authorize proxying
        const authMatch = pathname.match(/^\/api\/response-actions\/([^/]+)\/authorize$/);
        if (authMatch && method === 'POST') {
          if (!this.backendUrl || !this.token) {
            return sendJson(503, { error: 'Manager connection not configured' });
          }
          try {
            const targetUrl = `${this.backendUrl.replace(/\/+$/, '')}/api/v1/response-actions/${authMatch[1]}/authorize`;
            const bRes = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
              },
            });
            const data = await bRes.json();
            return sendJson(bRes.status, data);
          } catch (err) {
            return sendJson(502, { error: `could not reach Manager: ${err.message}` });
          }
        }

        // Reject proxying
        const rejMatch = pathname.match(/^\/api\/response-actions\/([^/]+)\/reject$/);
        if (rejMatch && method === 'POST') {
          if (!this.backendUrl || !this.token) {
            return sendJson(503, { error: 'Manager connection not configured' });
          }
          let bodyStr = '';
          req.on('data', (c) => (bodyStr += c));
          req.on('end', async () => {
            let body = {};
            try {
              body = JSON.parse(bodyStr || '{}');
            } catch (e) {
              return sendJson(400, { error: 'Invalid JSON body' });
            }
            const reason = body.reason ? String(body.reason).trim() : '';
            if (!reason) {
              return sendJson(400, { error: 'Rejection requires non-empty reason' });
            }
            try {
              const targetUrl = `${this.backendUrl.replace(/\/+$/, '')}/api/v1/response-actions/${rejMatch[1]}/reject`;
              const bRes = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${this.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
              });
              const data = await bRes.json();
              return sendJson(bRes.status, data);
            } catch (err) {
              return sendJson(502, { error: `could not reach Manager: ${err.message}` });
            }
          });
          return;
        }

        sendJson(404, { error: 'not found' });
      });

      this.server.listen(this.port, '127.0.0.1', () => resolve());
      this.server.on('error', reject);
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

module.exports = {
  MockProxyServer,
};
