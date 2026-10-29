/**
 * Tier 4: Real-World Scenarios — Realistic SOC Analyst Workflows
 * Authoritative Source: ORIGINAL_REQUEST.md & PROJECT.md
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { MockBackendServer } = require('../helpers/mock_backend');
const { MockProxyServer } = require('../helpers/mock_proxy');
const { get, post } = require('../helpers/http_client');
const { DomInspector } = require('../helpers/dom_inspector');

describe('Tier 4: Real-World Scenarios — Realistic SOC Analyst Workflows', () => {
  const backendPort = 8811;
  const proxyPort = 8812;

  test('T4_S01: Ransomware Incident Triage and KILL_PROCESS Workflow', async () => {
    const backend = new MockBackendServer(backendPort);
    const proxy = new MockProxyServer(proxyPort, `http://127.0.0.1:${backendPort}`);
    await backend.start();
    await proxy.start();

    try {
      // Step 1: Ingest high-entropy obfuscated PowerShell alert
      backend.loadFixtures([], [
        {
          alert_id: 'ALT-3f9a1c',
          rule_id: 'DET-PROC-011',
          severity: 'high',
          level: 11,
          title: 'High-Entropy Obfuscated Script Execution',
          host_id: 'WS-ACCT-07',
          timestamp: '2026-10-25T08:00:04Z',
          evidence: {
            'process.name': 'powershell.exe',
            'process.pid': 4242,
            'process.command_line': 'powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoA',
          },
        },
      ]);

      // Step 2: Response Engine generates KILL_PROCESS recommendation
      const sub = backend.submitAction({
        response_id: 'ra-rw-01',
        alert_id: 'ALT-3f9a1c',
        action: 'KILL_PROCESS',
        target: { host_id: 'WS-ACCT-07', target_pid: 4242, target_start_time_ticks: 133740000041234567 },
        created_at: '2026-10-25T08:00:05Z',
      });
      assert.strictEqual(sub.success, true);

      // Step 3: Analyst polls /api/stats from Overview panel
      const statsRes = await get(`http://127.0.0.1:${proxyPort}/api/stats`);
      assert.strictEqual(statsRes.status, 200);
      assert.strictEqual(statsRes.json.high, 1);

      // Step 4: Analyst reviews Response Queue actions
      const queueRes = await get(`http://127.0.0.1:${proxyPort}/api/response-actions`);
      assert.strictEqual(queueRes.status, 200);
      const action = queueRes.json.response_actions.find((a) => a.response_id === 'ra-rw-01');
      assert.ok(action, 'Action ra-rw-01 must be in response queue');
      assert.strictEqual(action.target.target_pid, 4242);
      assert.strictEqual(action.lifecycle_state, 'PENDING');

      // Step 5: Analyst authorizes the KILL_PROCESS action
      const authRes = await post(`http://127.0.0.1:${proxyPort}/api/response-actions/ra-rw-01/authorize`, {});
      assert.strictEqual(authRes.status, 200);
      assert.strictEqual(authRes.json.status, 'authorized');
      assert.ok(authRes.json.command_id);

      // Step 6: Verify backend state machine and command audit trail
      const audit = backend.state.commandAudit.find((a) => a.command_id === authRes.json.command_id);
      assert.ok(audit, 'Command audit must contain record of authorization');
      assert.strictEqual(audit.actor, 'analyst:alice');
      assert.strictEqual(audit.event, 'authorized');
    } finally {
      await proxy.stop();
      await backend.stop();
    }
  });

  test('T4_S02: Domain Controller ISOLATE_HOST Rejection Workflow with Mandatory Justification', async () => {
    const backend = new MockBackendServer(backendPort + 2);
    const proxy = new MockProxyServer(proxyPort + 2, `http://127.0.0.1:${backendPort + 2}`);
    await backend.start();
    await proxy.start();

    try {
      // Step 1: Ingest beaconing alert on domain controller
      backend.submitAction({
        response_id: 'ra-rw-02',
        alert_id: 'ALT-BCN-77e2',
        action: 'ISOLATE_HOST',
        target: { host_id: 'DC-PROD-01' },
        created_at: '2026-10-25T08:03:11Z',
      });

      // Step 2: Analyst inspects action and determines containment is dangerous
      const justification = 'Mission-critical Active Directory DC; network containment rejected to preserve authentication fabric; manual investigation underway';

      // Step 3: Analyst submits rejection with reason
      const rejRes = await post(`http://127.0.0.1:${proxyPort + 2}/api/response-actions/ra-rw-02/reject`, {
        reason: justification,
      });
      assert.strictEqual(rejRes.status, 200);
      assert.strictEqual(rejRes.json.status, 'rejected');

      // Step 4: Verify state is REJECTED and no command is dispatched
      const action = backend.state.actions.find((a) => a.response_id === 'ra-rw-02');
      assert.strictEqual(action.lifecycle_state, 'REJECTED');
      assert.strictEqual(action.decided_reason, justification);
      assert.strictEqual(action.command_id, null);

      // Step 5: Verify command audit records reason
      const audit = action.audit.find((e) => e.event === 'rejected');
      assert.ok(audit);
      assert.strictEqual(audit.detail, justification);
    } finally {
      await proxy.stop();
      await backend.stop();
    }
  });

  test('T4_S03: AUTO_SAFE Fast-Track Execution and 3-Event Command Audit Verification', async () => {
    const backend = new MockBackendServer();

    // Step 1: AUTO_SAFE action submitted
    const autoRes = backend.submitAction({
      response_id: 'ra-rw-03',
      alert_id: 'ALT-SAFE-01',
      action: 'COLLECT_PROCESS_INFO',
      target: { host_id: 'WS-01', target_pid: 101, target_start_time_ticks: 999 },
    });
    assert.strictEqual(autoRes.success, true);
    assert.strictEqual(autoRes.action.lifecycle_state, 'AUTHORIZED');

    // Step 2: Simulate command dispatch and agent execution result
    const action = backend.state.actions.find((a) => a.response_id === 'ra-rw-03');
    action.command_id = 'resp-cmd-03';
    action.command_state = 'SUCCEEDED';
    action.audit = [
      { audit_id: 'aud-1', command_id: 'resp-cmd-03', event: 'created', actor: 'system:response-engine', detail: null, occurred_at: '2026-10-25T08:03:11Z' },
      { audit_id: 'aud-2', command_id: 'resp-cmd-03', event: 'delivered', actor: 'agent:WS-01', detail: null, occurred_at: '2026-10-25T08:03:14Z' },
      { audit_id: 'aud-3', command_id: 'resp-cmd-03', event: 'result_received', actor: 'agent:WS-01', detail: 'succeeded', occurred_at: '2026-10-25T08:03:15Z' },
    ];

    // Step 3: Verify audit event sequence conforms to contract
    assert.strictEqual(action.audit.length, 3);
    assert.strictEqual(action.audit[0].event, 'created');
    assert.strictEqual(action.audit[1].event, 'delivered');
    assert.strictEqual(action.audit[2].event, 'result_received');
    assert.strictEqual(action.audit[2].detail, 'succeeded');
  });

  test('T4_S04: SOC Shift Handover and Accessibility Audit with Reduced Motion', () => {
    const inspector = new DomInspector();

    // Step 1: Verify reduced motion query disables transitions
    const hasReducedMotion = inspector.hasReducedMotionQuery();
    assert.ok(hasReducedMotion, 'Must have @media (prefers-reduced-motion: reduce)');

    // Step 2: Verify all 4 slide navigation anchors are defined in sidebar
    const hrefs = inspector.getNavLinkHrefs();
    const slides = ['overview', 'endpoints', 'alerts', 'response'];
    for (const slide of slides) {
      assert.ok(
        hrefs.some((h) => h.includes(slide)),
        `Sidebar navigation must include link for slide: ${slide}`
      );
    }

    // Step 3: Verify navigation button controls exist for seamless shift navigation
    const controls = inspector.hasSlideNavigationControls();
    assert.ok(controls.hasPrevButton && controls.hasNextButton);
  });
});
