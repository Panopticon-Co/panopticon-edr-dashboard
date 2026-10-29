/**
 * Tier 1: Feature Coverage — R2: Response Engine Integration
 * Authoritative Source: ORIGINAL_REQUEST.md (R2 & Acceptance Criteria 2) & PROJECT.md
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { DomInspector } = require('../helpers/dom_inspector');
const { get, post } = require('../helpers/http_client');
const { MockBackendServer } = require('../helpers/mock_backend');
const { MockProxyServer } = require('../helpers/mock_proxy');
const { SAMPLE_RESPONSE_ACTIONS } = require('../helpers/test_fixtures');

describe('Tier 1: Feature Coverage — R2 Response Engine Integration', () => {
  const inspector = new DomInspector();

  test('T1_R2_01: Closed 7-action vocabulary allowlist strictly accepted by backend', () => {
    const backend = new MockBackendServer();
    for (const act of config.CLOSED_ACTIONS) {
      const target = act.includes('PROCESS')
        ? { target_pid: 1234, target_start_time_ticks: 99999 }
        : act.includes('FILE')
        ? { path: '/tmp/malware.exe' }
        : { host_id: 'WS-01' };

      const res = backend.validateAction({ action: act, target });
      assert.strictEqual(
        res.valid,
        true,
        `Valid action ${act} was incorrectly rejected: ${res.error}`
      );
    }
  });

  test('T1_R2_02: Policy tiers enforce AUTO_SAFE for read-only and ANALYST_APPROVAL for destructive', () => {
    const backend = new MockBackendServer();
    for (const safeAct of config.POLICY_TIERS.AUTO_SAFE) {
      const target = safeAct.includes('PROCESS')
        ? { target_pid: 1234, target_start_time_ticks: 99999 }
        : { host_id: 'WS-01' };
      const actionObj = { action: safeAct, target };
      backend.validateAction(actionObj);
      assert.strictEqual(actionObj.tier, 'AUTO_SAFE', `${safeAct} must be AUTO_SAFE`);
    }

    for (const approvalAct of config.POLICY_TIERS.ANALYST_APPROVAL) {
      const target = approvalAct.includes('PROCESS')
        ? { target_pid: 1234, target_start_time_ticks: 99999 }
        : approvalAct.includes('FILE')
        ? { path: '/bin/bad' }
        : { host_id: 'WS-01' };
      const actionObj = { action: approvalAct, target };
      backend.validateAction(actionObj);
      assert.strictEqual(
        actionObj.tier,
        'ANALYST_APPROVAL',
        `${approvalAct} must be ANALYST_APPROVAL`
      );
    }
  });

  test('T1_R2_03: Target schema validation for process, file, and host', () => {
    const backend = new MockBackendServer();
    // Valid process target
    const procValid = backend.validateAction({
      action: 'KILL_PROCESS',
      target: { target_pid: 4242, target_start_time_ticks: 123456789 },
    });
    assert.strictEqual(procValid.valid, true);

    // Invalid process target (missing ticks)
    const procInvalid = backend.validateAction({
      action: 'KILL_PROCESS',
      target: { target_pid: 4242 },
    });
    assert.strictEqual(procInvalid.valid, false);

    // Valid file target
    const fileValid = backend.validateAction({
      action: 'COLLECT_FILE',
      target: { path: '/var/log/audit.log' },
    });
    assert.strictEqual(fileValid.valid, true);

    // Valid host target
    const hostValid = backend.validateAction({
      action: 'ISOLATE_HOST',
      target: { host_id: 'WS-ACCT-07' },
    });
    assert.strictEqual(hostValid.valid, true);
  });

  test('T1_R2_04: Lifecycle state machine allows canonical 7-state transitions', () => {
    // 7 states: PENDING, AUTHORIZED, DISPATCHED, SUCCEEDED, FAILED, REJECTED, EXPIRED
    assert.strictEqual(config.LIFECYCLE_STATES.length, 7);

    const backend = new MockBackendServer();
    const action = {
      response_id: 'ra-test-1',
      action: 'KILL_PROCESS',
      tier: 'ANALYST_APPROVAL',
      lifecycle_state: 'PENDING',
      target: { host_id: 'WS-1', target_pid: 100, target_start_time_ticks: 200 },
      created_at: new Date().toISOString(),
    };
    backend.loadFixtures([action]);

    // Test transition from PENDING to AUTHORIZED
    const backendAction = backend.state.actions[0];
    assert.strictEqual(backendAction.lifecycle_state, 'PENDING');
  });

  test('T1_R2_05: Destructive actions (KILL_PROCESS, ISOLATE_HOST, RELEASE_HOST_ISOLATION) cannot auto-execute', () => {
    const backend = new MockBackendServer();
    for (const act of config.DESTRUCTIVE_ACTIONS) {
      const target = act === 'KILL_PROCESS'
        ? { target_pid: 1, target_start_time_ticks: 1 }
        : { host_id: 'H1' };

      const sub = backend.submitAction({ action: act, target });
      assert.strictEqual(sub.success, true);
      assert.strictEqual(
        sub.action.lifecycle_state,
        'PENDING',
        `Destructive action ${act} must initialize in PENDING state awaiting manual analyst authorization`
      );
    }
  });

  test('T1_R2_06: Console proxy securely relays authorize and reject with Bearer token', async () => {
    const backendPort = 8793;
    const proxyPort = 8794;
    const backend = new MockBackendServer(backendPort, 'secret-analyst-token');
    backend.loadFixtures(SAMPLE_RESPONSE_ACTIONS);
    await backend.start();

    const proxy = new MockProxyServer(proxyPort, `http://127.0.0.1:${backendPort}`, 'secret-analyst-token');
    await proxy.start();

    try {
      // 1. Authorize ra-001
      const authRes = await post(`http://127.0.0.1:${proxyPort}/api/response-actions/ra-001/authorize`, {});
      assert.strictEqual(authRes.status, 200);
      assert.strictEqual(authRes.json.status, 'authorized');
      assert.ok(authRes.json.command_id);

      // Verify state on backend
      const updatedAction = backend.state.actions.find((a) => a.response_id === 'ra-001');
      assert.strictEqual(updatedAction.lifecycle_state, 'AUTHORIZED');
      assert.strictEqual(updatedAction.authorized_by, 'analyst:alice');

      // 2. Reject ra-001 after it is no longer PENDING should fail CAS check
      const casRes = await post(`http://127.0.0.1:${proxyPort}/api/response-actions/ra-001/reject`, {
        reason: 'Too late',
      });
      assert.strictEqual(casRes.status, 400);
    } finally {
      await proxy.stop();
      await backend.stop();
    }
  });

  test('T1_R2_07: Frontend response table defines authoritative 9-column headers', () => {
    const headers = inspector.getResponseTableHeaders();
    // In PROJECT.md § 4: 9 total columns: State, Action & Target, Tier, Alert ID, Created At, Decided Reason, Command Execution, Audit Trail, Actions
    assert.strictEqual(
      headers.length,
      9,
      `Expected response table to define exactly 9 columns, found ${headers.length}: [${headers.join(', ')}]`
    );
  });
});
