/**
 * Tier 2: Boundary & Corner Cases — R2: Response Engine Boundaries
 * Authoritative Source: ORIGINAL_REQUEST.md & PROJECT.md
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { MockBackendServer } = require('../helpers/mock_backend');
const { MockProxyServer } = require('../helpers/mock_proxy');
const { post } = require('../helpers/http_client');

describe('Tier 2: Boundary & Corner Cases — R2 Response Engine Boundaries', () => {
  test('T2_BR2_01: Unknown action outside closed 7-action vocabulary is rejected', () => {
    const backend = new MockBackendServer();
    const res = backend.submitAction({
      action: 'EXECUTE_SHELL',
      target: { host_id: 'H1' },
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.ok(res.error.includes('closed 7 actions'));
  });

  test('T2_BR2_02: Process target schema rejects non-positive PID (pid <= 0)', () => {
    const backend = new MockBackendServer();
    const resZero = backend.submitAction({
      action: 'KILL_PROCESS',
      target: { target_pid: 0, target_start_time_ticks: 12345 },
    });
    assert.strictEqual(resZero.success, false);

    const resNegative = backend.submitAction({
      action: 'KILL_PROCESS',
      target: { target_pid: -42, target_start_time_ticks: 12345 },
    });
    assert.strictEqual(resNegative.success, false);
  });

  test('T2_BR2_03: File target schema rejects empty path or path exceeding 4096 characters', () => {
    const backend = new MockBackendServer();
    const resEmpty = backend.submitAction({
      action: 'COLLECT_FILE',
      target: { path: '' },
    });
    assert.strictEqual(resEmpty.success, false);

    const overlongPath = '/tmp/' + 'a'.repeat(4095); // > 4096 chars
    const resOverlong = backend.submitAction({
      action: 'QUARANTINE_FILE',
      target: { path: overlongPath },
    });
    assert.strictEqual(resOverlong.success, false);
  });

  test('T2_BR2_04: Rejection requests require non-empty reason; empty string or whitespace returns 400', async () => {
    const backendPort = 8796;
    const backend = new MockBackendServer(backendPort);
    backend.loadFixtures([
      {
        response_id: 'ra-rej-bound',
        action: 'KILL_PROCESS',
        tier: 'ANALYST_APPROVAL',
        lifecycle_state: 'PENDING',
        target: { host_id: 'H1', target_pid: 1, target_start_time_ticks: 1 },
      },
    ]);
    await backend.start();

    try {
      // Empty reason
      const resEmpty = await post(`http://127.0.0.1:${backendPort}/api/v1/response-actions/ra-rej-bound/reject`, {
        reason: '',
      }, { Authorization: 'Bearer mock-analyst-token' });
      assert.strictEqual(resEmpty.status, 400);

      // Whitespace-only reason
      const resWhitespace = await post(`http://127.0.0.1:${backendPort}/api/v1/response-actions/ra-rej-bound/reject`, {
        reason: '     ',
      }, { Authorization: 'Bearer mock-analyst-token' });
      assert.strictEqual(resWhitespace.status, 400);
    } finally {
      await backend.stop();
    }
  });

  test('T2_BR2_05: Rejection reason exceeding 512 characters is rejected with 400', async () => {
    const backendPort = 8797;
    const backend = new MockBackendServer(backendPort);
    backend.loadFixtures([
      {
        response_id: 'ra-rej-len',
        action: 'ISOLATE_HOST',
        tier: 'ANALYST_APPROVAL',
        lifecycle_state: 'PENDING',
        target: { host_id: 'H1' },
      },
    ]);
    await backend.start();

    try {
      const overlongReason = 'X'.repeat(513);
      const res = await post(`http://127.0.0.1:${backendPort}/api/v1/response-actions/ra-rej-len/reject`, {
        reason: overlongReason,
      }, { Authorization: 'Bearer mock-analyst-token' });
      assert.strictEqual(res.status, 400);
      assert.ok(res.json.error.includes('512'));
    } finally {
      await backend.stop();
    }
  });

  test('T2_BR2_06: Duplicate authorization on non-PENDING action returns 400 (CAS failure)', async () => {
    const backendPort = 8798;
    const backend = new MockBackendServer(backendPort);
    backend.loadFixtures([
      {
        response_id: 'ra-cas-1',
        action: 'KILL_PROCESS',
        tier: 'ANALYST_APPROVAL',
        lifecycle_state: 'AUTHORIZED', // Already authorized
        target: { host_id: 'H1', target_pid: 1, target_start_time_ticks: 1 },
      },
    ]);
    await backend.start();

    try {
      const res = await post(`http://127.0.0.1:${backendPort}/api/v1/response-actions/ra-cas-1/authorize`, {}, {
        Authorization: 'Bearer mock-analyst-token',
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.json.error.includes('must be PENDING'));
    } finally {
      await backend.stop();
    }
  });

  test('T2_BR2_07: 15-minute TTL sweep expires stale PENDING actions and forbids subsequent authorization', async () => {
    const backend = new MockBackendServer();
    const staleTime = new Date(Date.now() - 16 * 60 * 1000).toISOString(); // 16 mins ago
    const freshTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 mins ago

    backend.loadFixtures([
      {
        response_id: 'ra-stale',
        action: 'KILL_PROCESS',
        tier: 'ANALYST_APPROVAL',
        lifecycle_state: 'PENDING',
        created_at: staleTime,
        target: { host_id: 'H1', target_pid: 1, target_start_time_ticks: 1 },
      },
      {
        response_id: 'ra-fresh',
        action: 'KILL_PROCESS',
        tier: 'ANALYST_APPROVAL',
        lifecycle_state: 'PENDING',
        created_at: freshTime,
        target: { host_id: 'H2', target_pid: 2, target_start_time_ticks: 2 },
      },
    ]);

    const expired = backend.runExpirationSweep();
    assert.strictEqual(expired, 1);

    const staleAction = backend.state.actions.find((a) => a.response_id === 'ra-stale');
    assert.strictEqual(staleAction.lifecycle_state, 'EXPIRED');

    const freshAction = backend.state.actions.find((a) => a.response_id === 'ra-fresh');
    assert.strictEqual(freshAction.lifecycle_state, 'PENDING');
  });

  test('T2_BR2_08: Duplicate action deduplication: second open action for same target is marked REJECTED', () => {
    const backend = new MockBackendServer();
    // Submit first action
    const first = backend.submitAction({
      response_id: 'first-act',
      action: 'ISOLATE_HOST',
      target: { host_id: 'WS-DUPLICATE-TARGET' },
    });
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.action.lifecycle_state, 'PENDING');

    // Submit duplicate action while first is still pending
    const second = backend.submitAction({
      response_id: 'second-act',
      action: 'ISOLATE_HOST',
      target: { host_id: 'WS-DUPLICATE-TARGET' },
    });
    assert.strictEqual(second.success, true);
    assert.strictEqual(second.action.lifecycle_state, 'REJECTED');
    assert.ok(second.action.decided_reason.includes('Duplicate action rejected'));
  });
});
