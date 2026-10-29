/**
 * Test Fixtures and Authoritative Contracts
 * Derived from ORIGINAL_REQUEST.md and PROJECT.md.
 */

const SAMPLE_ALERTS = [
  {
    alert_id: 'ALT-3f9a1c',
    rule_id: 'DET-PROC-011',
    detection_source: 'rule',
    title: 'High-Entropy Obfuscated Script Execution',
    severity: 'high',
    level: 11,
    host_id: 'WS-ACCT-07',
    timestamp: '2026-10-25T08:00:04Z',
    mitre_tactic: 'Execution',
    mitre_technique: 'T1059.001',
    evidence: {
      'process.name': 'powershell.exe',
      'process.pid': 4242,
      'process.command_line': 'powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoA',
    },
  },
  {
    alert_id: 'ALT-BCN-77e2',
    rule_id: 'BEH-BEACON-001',
    detection_source: 'behavioral',
    title: 'Periodic outbound connection (beacon-like)',
    severity: 'medium',
    level: 8,
    host_id: 'WS-ACCT-07',
    timestamp: '2026-10-25T08:03:10Z',
    mitre_tactic: 'Command and Control',
    mitre_technique: 'T1071.001',
    evidence: {
      'process.name': 'powershell.exe',
      'network.remote_ip': '203.0.113.50',
      'network.remote_port': 443,
    },
  },
];

const SAMPLE_RESPONSE_ACTIONS = [
  {
    response_id: 'ra-001',
    alert_id: 'ALT-3f9a1c',
    action: 'KILL_PROCESS',
    tier: 'ANALYST_APPROVAL',
    lifecycle_state: 'PENDING',
    target: { host_id: 'WS-ACCT-07', target_pid: 4242, target_start_time_ticks: 133740000041234567 },
    command_id: null,
    command_state: null,
    created_at: '2026-10-25T08:00:05Z',
    authorized_at: null,
    authorized_by: null,
    decided_reason: 'High-entropy script execution detected on finance host',
    audit: [],
  },
  {
    response_id: 'ra-002',
    alert_id: 'ALT-BCN-77e2',
    action: 'COLLECT_NETWORK_CONNECTIONS',
    tier: 'AUTO_SAFE',
    lifecycle_state: 'AUTHORIZED',
    target: { host_id: 'WS-ACCT-07', target_pid: 4242, target_start_time_ticks: 133740000041234567 },
    command_id: 'resp-ra-002',
    command_state: 'SUCCEEDED',
    created_at: '2026-10-25T08:03:11Z',
    authorized_at: '2026-10-25T08:03:11Z',
    authorized_by: 'system:response-engine',
    decided_reason: 'Auto-safe telemetry collection',
    audit: [
      { audit_id: 'ca-1', command_id: 'resp-ra-002', event: 'created', actor: 'system:response-engine', detail: null, occurred_at: '2026-10-25T08:03:11Z' },
      { audit_id: 'ca-2', command_id: 'resp-ra-002', event: 'delivered', actor: 'agent:WS-ACCT-07', detail: null, occurred_at: '2026-10-25T08:03:14Z' },
      { audit_id: 'ca-3', command_id: 'resp-ra-002', event: 'result_received', actor: 'agent:WS-ACCT-07', detail: 'succeeded', occurred_at: '2026-10-25T08:03:15Z' },
    ],
  },
  {
    response_id: 'ra-003',
    alert_id: 'ALT-BCN-77e2',
    action: 'ISOLATE_HOST',
    tier: 'ANALYST_APPROVAL',
    lifecycle_state: 'REJECTED',
    target: { host_id: 'DC-PROD-01' },
    command_id: null,
    command_state: null,
    created_at: '2026-10-25T08:03:11Z',
    authorized_at: null,
    authorized_by: 'analyst:aditya',
    decided_reason: 'Mission-critical Domain Controller; containment rejected to prevent auth outage',
    audit: [
      { audit_id: 'ia-rej-1', command_id: null, event: 'rejected', actor: 'analyst:aditya', detail: 'Mission-critical Domain Controller', occurred_at: '2026-10-25T08:05:00Z' },
    ],
  },
];

module.exports = {
  SAMPLE_ALERTS,
  SAMPLE_RESPONSE_ACTIONS,
};
