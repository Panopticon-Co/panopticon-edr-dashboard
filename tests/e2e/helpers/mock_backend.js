/**
 * Mock Backend Service implementing PROJECT.md Interface Contracts
 * Emulates Spring Boot Backend (:8788) for Isolated E2E Verification
 */
const http = require('node:http');
const config = require('../config');

class MockBackendServer {
  constructor(port = config.MOCK_BACKEND_PORT, token = config.MANAGER_TOKEN) {
    this.port = port;
    this.token = token;
    this.server = null;
    this.state = {
      actions: [],
      commandAudit: [],
      alerts: [],
      stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0, hosts_alerting: 0 },
    };
  }

  reset() {
    this.state.actions = [];
    this.state.commandAudit = [];
    this.state.alerts = [];
    this.state.stats = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0, hosts_alerting: 0 };
  }

  loadFixtures(actions = [], alerts = []) {
    this.state.actions = JSON.parse(JSON.stringify(actions));
    this.state.alerts = JSON.parse(JSON.stringify(alerts));
    this.updateStats();
  }

  updateStats() {
    const counts = { total: this.state.alerts.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const hosts = new Set();
    for (const a of this.state.alerts) {
      const s = String(a.severity || 'info').toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
      const h = a.host_id || (a.evidence && a.evidence['host.id']);
      if (h) hosts.add(h);
    }
    counts.hosts_alerting = hosts.size;
    this.state.stats = counts;
  }

  // --- Policy and Validation Engine ---
  validateAction(actionObj) {
    // Closed 7-action allowlist
    if (!config.CLOSED_ACTIONS.includes(actionObj.action)) {
      return { valid: false, error: `Invalid action: ${actionObj.action}. Must be one of closed 7 actions.` };
    }

    // Policy Tier Assignment
    if (config.POLICY_TIERS.AUTO_SAFE.includes(actionObj.action)) {
      actionObj.tier = 'AUTO_SAFE';
    } else {
      actionObj.tier = 'ANALYST_APPROVAL';
    }

    // Target schema validation
    const target = actionObj.target || {};
    if (['KILL_PROCESS', 'COLLECT_PROCESS_INFO'].includes(actionObj.action)) {
      if (!target.target_pid || target.target_pid <= 0 || !target.target_start_time_ticks || target.target_start_time_ticks <= 0) {
        return { valid: false, error: 'Process actions require positive target_pid and target_start_time_ticks' };
      }
    } else if (['COLLECT_FILE', 'QUARANTINE_FILE'].includes(actionObj.action)) {
      if (!target.path || typeof target.path !== 'string' || target.path.length < 1 || target.path.length > 4096) {
        return { valid: false, error: 'File actions require non-empty path (1..4096 chars)' };
      }
    } else if (['ISOLATE_HOST', 'RELEASE_HOST_ISOLATION'].includes(actionObj.action)) {
      // Host actions expect host_id but empty process/file targets
      if (!target.host_id) {
        return { valid: false, error: 'Host actions require target host_id' };
      }
    }

    // Destructive action safeguards: never auto-execute
    if (config.DESTRUCTIVE_ACTIONS.includes(actionObj.action) && actionObj.tier === 'AUTO_SAFE') {
      return { valid: false, error: 'Destructive action cannot be categorized as AUTO_SAFE' };
    }

    return { valid: true };
  }

  // --- 15-Minute Expiration Sweep ---
  runExpirationSweep(now = new Date()) {
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    let expiredCount = 0;
    for (const action of this.state.actions) {
      if (action.lifecycle_state === 'PENDING') {
        const createdAt = new Date(action.created_at);
        if (createdAt < fifteenMinutesAgo) {
          action.lifecycle_state = 'EXPIRED';
          expiredCount++;
          this.state.commandAudit.push({
            audit_id: `aud-exp-${Date.now()}-${action.response_id}`,
            command_id: action.command_id,
            event: 'expired',
            actor: 'system:expiration-sweep',
            detail: '15-minute TTL elapsed without analyst decision',
            occurred_at: now.toISOString(),
          });
        }
      }
    }
    return expiredCount;
  }

  // --- Duplicate Action Deduplication ---
  submitAction(actionObj) {
    const val = this.validateAction(actionObj);
    if (!val.valid) return { success: false, status: 400, error: val.error };

    // Check for open duplicate action for same host and action
    const existingOpen = this.state.actions.find(
      (a) =>
        a.target?.host_id === actionObj.target?.host_id &&
        a.action === actionObj.action &&
        ['PENDING', 'AUTHORIZED', 'DISPATCHED'].includes(a.lifecycle_state)
    );

    actionObj.command_id = actionObj.command_id || null;
    if (existingOpen) {
      actionObj.lifecycle_state = 'REJECTED';
      actionObj.decided_reason = `Duplicate action rejected; existing open action ${existingOpen.response_id}`;
    } else {
      actionObj.lifecycle_state = actionObj.tier === 'AUTO_SAFE' ? 'AUTHORIZED' : 'PENDING';
    }

    this.state.actions.push(actionObj);
    return { success: true, status: 201, action: actionObj };
  }

  // --- HTTP Server ---
  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${this.port}`);
        const pathname = url.pathname;
        const method = req.method;

        // Helper to send json
        const sendJson = (status, obj) => {
          const body = Buffer.from(JSON.stringify(obj), 'utf8');
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Content-Length': body.length,
          });
          res.end(body);
        };

        // Decommissioned Telemetry check (R1)
        if (pathname === '/api/v1/telemetry/fluctuations' || pathname === '/api/telemetry/fluctuations') {
          return sendJson(404, { error: 'Telemetry fluctuations endpoint has been completely decommissioned.' });
        }

        // Shared Core Endpoints (Preserved in R1)
        if (pathname === '/api/v1/stats' || pathname === '/api/stats') {
          return sendJson(200, this.state.stats);
        }
        if (pathname === '/api/v1/alerts' || pathname === '/api/alerts') {
          return sendJson(200, { alerts: this.state.alerts });
        }
        if (pathname === '/api/v1/health') {
          return sendJson(200, { status: 'UP' });
        }

        // Response Actions Routing (Dual Endpoint: /api/v1/response-actions and /api/response-actions)
        if (pathname === '/api/v1/response-actions' || pathname === '/api/response-actions') {
          if (method === 'GET') {
            return sendJson(200, { response_actions: this.state.actions });
          }
        }

        // Authorize Action
        const authMatch = pathname.match(/^\/api(?:\/v1)?\/response-actions\/([^/]+)\/authorize$/);
        if (authMatch && method === 'POST') {
          const authHeader = req.headers['authorization'];
          if (!authHeader || authHeader !== `Bearer ${this.token}`) {
            return sendJson(401, { error: 'Unauthorized: valid analyst Bearer token required' });
          }
          const actionId = authMatch[1];
          const action = this.state.actions.find((a) => a.response_id === actionId);
          if (!action) {
            return sendJson(404, { error: `Response action not found: ${actionId}` });
          }
          // CAS Check: Must be in PENDING state
          if (action.lifecycle_state !== 'PENDING') {
            return sendJson(400, {
              error: `Cannot authorize action in state ${action.lifecycle_state}; must be PENDING`,
            });
          }

          action.lifecycle_state = 'AUTHORIZED';
          action.command_id = `cmd-${Date.now()}-${actionId}`;
          action.command_state = 'DISPATCHED';
          action.authorized_by = 'analyst:alice';
          action.authorized_at = new Date().toISOString();

          const auditEvent = {
            audit_id: `aud-${Date.now()}`,
            command_id: action.command_id,
            event: 'authorized',
            actor: 'analyst:alice',
            detail: 'Authorized by security analyst',
            occurred_at: action.authorized_at,
          };
          action.audit = action.audit || [];
          action.audit.push(auditEvent);
          this.state.commandAudit.push(auditEvent);

          return sendJson(200, {
            response_id: actionId,
            status: 'authorized',
            authorized_by: action.authorized_by,
            command_id: action.command_id,
          });
        }

        // Reject Action
        const rejMatch = pathname.match(/^\/api(?:\/v1)?\/response-actions\/([^/]+)\/reject$/);
        if (rejMatch && method === 'POST') {
          const authHeader = req.headers['authorization'];
          if (!authHeader || authHeader !== `Bearer ${this.token}`) {
            return sendJson(401, { error: 'Unauthorized: valid analyst Bearer token required' });
          }
          const actionId = rejMatch[1];
          const action = this.state.actions.find((a) => a.response_id === actionId);
          if (!action) {
            return sendJson(404, { error: `Response action not found: ${actionId}` });
          }
          // CAS Check
          if (action.lifecycle_state !== 'PENDING') {
            return sendJson(400, {
              error: `Cannot reject action in state ${action.lifecycle_state}; must be PENDING`,
            });
          }

          // Parse body
          let bodyStr = '';
          req.on('data', (chunk) => (bodyStr += chunk));
          req.on('end', () => {
            let body = {};
            try {
              body = JSON.parse(bodyStr || '{}');
            } catch (e) {
              return sendJson(400, { error: 'Invalid JSON body' });
            }

            const reason = body.reason ? String(body.reason).trim() : '';
            if (!reason || reason.length < 1 || reason.length > 512) {
              return sendJson(400, { error: 'Rejection requires non-empty reason between 1 and 512 characters' });
            }

            action.lifecycle_state = 'REJECTED';
            action.decided_reason = reason;
            action.authorized_by = 'analyst:alice';

            const auditEvent = {
              audit_id: `aud-rej-${Date.now()}`,
              command_id: null,
              event: 'rejected',
              actor: 'analyst:alice',
              detail: reason,
              occurred_at: new Date().toISOString(),
            };
            action.audit = action.audit || [];
            action.audit.push(auditEvent);
            this.state.commandAudit.push(auditEvent);

            return sendJson(200, {
              response_id: actionId,
              status: 'rejected',
              decided_reason: reason,
            });
          });
          return;
        }

        // Default 404
        sendJson(404, { error: 'Not found' });
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve();
      });
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
  MockBackendServer,
};
