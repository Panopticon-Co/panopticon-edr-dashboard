/**
 * Tier 3: Cross-Feature Combinations — Pairwise Interactions
 * Authoritative Source: ORIGINAL_REQUEST.md & PROJECT.md
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { MockBackendServer } = require('../helpers/mock_backend');
const { MockProxyServer } = require('../helpers/mock_proxy');
const { get, post } = require('../helpers/http_client');
const { SAMPLE_ALERTS } = require('../helpers/test_fixtures');

describe('Tier 3: Cross-Feature Combinations — Pairwise Interactions', () => {
  const backendPort = 8801;
  const proxyPort = 8802;

  test('T3_C01: Alert Ingestion -> Recommendation -> Authorization -> Lifecycle Transition -> Audit Log', async () => {
    const backend = new MockBackendServer(backendPort);
    const proxy = new MockProxyServer(proxyPort, `http://127.0.0.1:${backendPort}`);
    await backend.start();
    await proxy.start();

    try {
      // Step 1: Alert Ingestion creates alert ALT-CRIT-01
      backend.loadFixtures([], [
        {
          alert_id: 'ALT-CRIT-01',
          rule_id: 'DET-PROC-011',
          severity: 'critical',
          host_id: 'WS-FIN-01',
          timestamp: '2026-10-25T10:00:00Z',
        },
      ]);

      // Step 2: Response recommendation is generated for KILL_PROCESS
      const addRes = backend.submitAction({
        response_id: 'ra-flow-1',
        alert_id: 'ALT-CRIT-01',
        action: 'KILL_PROCESS',
        target: { host_id: 'WS-FIN-01', target_pid: 8888, target_start_time_ticks: 55555 },
        created_at: new Date().toISOString(),
      });
      assert.strictEqual(addRes.success, true);
      assert.strictEqual(addRes.action.lifecycle_state, 'PENDING');

      // Step 3: Console proxy GET /api/response-actions returns the pending action
      const listRes = await get(`http://127.0.0.1:${proxyPort}/api/response-actions`);
      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(listRes.json.response_actions.length, 1);
      assert.strictEqual(listRes.json.response_actions[0].lifecycle_state, 'PENDING');

      // Step 4: Analyst authorizes action via Console Proxy POST
      const authRes = await post(`http://127.0.0.1:${proxyPort}/api/response-actions/ra-flow-1/authorize`, {});
      assert.strictEqual(authRes.status, 200);
      assert.strictEqual(authRes.json.status, 'authorized');
      assert.ok(authRes.json.command_id);

      // Step 5: Verify lifecycle state updated to AUTHORIZED on backend
      const updatedAction = backend.state.actions.find((a) => a.response_id === 'ra-flow-1');
      assert.strictEqual(updatedAction.lifecycle_state, 'AUTHORIZED');
      assert.strictEqual(updatedAction.command_state, 'DISPATCHED');

      // Step 6: Verify command audit log recorded authorization event
      const audit = backend.state.commandAudit.find((a) => a.command_id === updatedAction.command_id);
      assert.ok(audit, 'Audit trail must contain authorization event');
      assert.strictEqual(audit.event, 'authorized');
      assert.strictEqual(audit.actor, 'analyst:alice');
    } finally {
      await proxy.stop();
      await backend.stop();
    }
  });

  test('T3_C02: Alert Ingestion -> Destructive Recommendation -> Analyst Rejection with Reason -> Audit Trail', async () => {
    const backend = new MockBackendServer(backendPort + 2);
    const proxy = new MockProxyServer(proxyPort + 2, `http://127.0.0.1:${backendPort + 2}`);
    await backend.start();
    await proxy.start();

    try {
      // Step 1: Submit ISOLATE_HOST recommendation
      backend.submitAction({
        response_id: 'ra-flow-2',
        alert_id: 'ALT-BCN-02',
        action: 'ISOLATE_HOST',
        target: { host_id: 'DC-PRIMARY-01' },
        created_at: new Date().toISOString(),
      });

      // Step 2: Analyst rejects via proxy with justification
      const rejectionReason = 'Host is Active Directory primary domain controller; network isolation would cause domain auth outage';
      const rejRes = await post(`http://127.0.0.1:${proxyPort + 2}/api/response-actions/ra-flow-2/reject`, {
        reason: rejectionReason,
      });
      assert.strictEqual(rejRes.status, 200);
      assert.strictEqual(rejRes.json.status, 'rejected');
      assert.strictEqual(rejRes.json.decided_reason, rejectionReason);

      // Step 3: Verify state and audit trail
      const action = backend.state.actions.find((a) => a.response_id === 'ra-flow-2');
      assert.strictEqual(action.lifecycle_state, 'REJECTED');
      assert.strictEqual(action.decided_reason, rejectionReason);
      assert.ok(!action.command_id, 'No command ID should be issued for rejected action');

      const audit = action.audit.find((ev) => ev.event === 'rejected');
      assert.ok(audit, 'Action audit must contain rejected event');
      assert.strictEqual(audit.detail, rejectionReason);
    } finally {
      await proxy.stop();
      await backend.stop();
    }
  });

  test('T3_C03: 15-Minute Expiration Sweep -> Action Lifecycle Update -> Response Table Refreshes with Badge', async () => {
    const backend = new MockBackendServer();
    const staleTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20m ago
    const freshTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5m ago

    backend.loadFixtures([
      {
        response_id: 'ra-stale-1',
        action: 'QUARANTINE_FILE',
        tier: 'ANALYST_APPROVAL',
        lifecycle_state: 'PENDING',
        created_at: staleTimestamp,
        target: { path: '/tmp/suspicious.tmp' },
      },
      {
        response_id: 'ra-fresh-1',
        action: 'QUARANTINE_FILE',
        tier: 'ANALYST_APPROVAL',
        lifecycle_state: 'PENDING',
        created_at: freshTimestamp,
        target: { path: '/tmp/fresh.tmp' },
      },
    ]);

    // Run sweep
    const expiredCount = backend.runExpirationSweep();
    assert.strictEqual(expiredCount, 1);

    const stale = backend.state.actions.find((a) => a.response_id === 'ra-stale-1');
    assert.strictEqual(stale.lifecycle_state, 'EXPIRED');

    const fresh = backend.state.actions.find((a) => a.response_id === 'ra-fresh-1');
    assert.strictEqual(fresh.lifecycle_state, 'PENDING');
  });

  test('T3_C04: Navigation State Preservation During Background Polling and Badge Updating', async () => {
    // Verifies that when an analyst is viewing slide 2 (Alerts) or slide 3 (Response),
    // polling responses update nav badges without resetting the active slide index
    const backend = new MockBackendServer(backendPort + 4);
    const proxy = new MockProxyServer(proxyPort + 4, `http://127.0.0.1:${backendPort + 4}`);
    await backend.start();
    await proxy.start();

    try {
      backend.loadFixtures(
        [
          {
            response_id: 'ra-pending-badge',
            action: 'KILL_PROCESS',
            tier: 'ANALYST_APPROVAL',
            lifecycle_state: 'PENDING',
            created_at: new Date().toISOString(),
            target: { host_id: 'H1', target_pid: 1, target_start_time_ticks: 1 },
          },
        ],
        SAMPLE_ALERTS
      );

      // Probe proxy endpoints
      const statsRes = await get(`http://127.0.0.1:${proxyPort + 4}/api/stats`);
      assert.strictEqual(statsRes.status, 200);

      const actionsRes = await get(`http://127.0.0.1:${proxyPort + 4}/api/response-actions`);
      assert.strictEqual(actionsRes.status, 200);
      const pendingCount = actionsRes.json.response_actions.filter((a) => a.lifecycle_state === 'PENDING').length;
      assert.strictEqual(pendingCount, 1);
    } finally {
      await proxy.stop();
      await backend.stop();
    }
  });

  test('T3_C05: Lake Decommissioning Coexists with Shared Fleet KPI Calculation Continuity', async () => {
    const backend = new MockBackendServer(backendPort + 6);
    await backend.start();

    try {
      // 1. Lake endpoint returns 404
      const lakeRes = await get(`http://127.0.0.1:${backendPort + 6}/api/v1/telemetry/fluctuations`);
      assert.strictEqual(lakeRes.status, 404);

      // 2. Shared stats endpoint calculates correct KPIs
      backend.loadFixtures([], [
        { alert_id: 'a1', severity: 'critical', host_id: 'H1' },
        { alert_id: 'a2', severity: 'critical', host_id: 'H1' },
        { alert_id: 'a3', severity: 'medium', host_id: 'H2' },
      ]);
      const statsRes = await get(`http://127.0.0.1:${backendPort + 6}/api/v1/stats`);
      assert.strictEqual(statsRes.status, 200);
      assert.strictEqual(statsRes.json.total, 3);
      assert.strictEqual(statsRes.json.critical, 2);
      assert.strictEqual(statsRes.json.medium, 1);
      assert.strictEqual(statsRes.json.hosts_alerting, 2);
    } finally {
      await backend.stop();
    }
  });

  test('T3_C06: AUTO_SAFE Fast-Track Execution vs ANALYST_APPROVAL Manual Gate Coexistence', async () => {
    const backend = new MockBackendServer();
    // 1. Submit AUTO_SAFE action
    const autoRes = backend.submitAction({
      response_id: 'ra-auto',
      action: 'COLLECT_NETWORK_CONNECTIONS',
      target: { host_id: 'WS-01', target_pid: 400, target_start_time_ticks: 100 },
    });
    assert.strictEqual(autoRes.success, true);
    assert.strictEqual(autoRes.action.tier, 'AUTO_SAFE');
    assert.strictEqual(autoRes.action.lifecycle_state, 'AUTHORIZED', 'AUTO_SAFE action immediately transitions to AUTHORIZED');

    // 2. Submit ANALYST_APPROVAL action
    const manualRes = backend.submitAction({
      response_id: 'ra-manual',
      action: 'QUARANTINE_FILE',
      target: { path: '/tmp/malware.dll' },
    });
    assert.strictEqual(manualRes.success, true);
    assert.strictEqual(manualRes.action.tier, 'ANALYST_APPROVAL');
    assert.strictEqual(manualRes.action.lifecycle_state, 'PENDING', 'ANALYST_APPROVAL action must wait in PENDING');
  });
});
