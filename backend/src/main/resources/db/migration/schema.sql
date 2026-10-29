-- Panopticon EDR Database Schema (SQLite / Spring Data JDBC compatible)

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    title TEXT,
    level INTEGER,
    severity TEXT,
    host_id TEXT,
    agent_id TEXT,
    event_id TEXT,
    alert_timestamp TEXT,
    created_at TEXT NOT NULL,
    mitre_tactic TEXT,
    mitre_technique TEXT,
    evidence_json TEXT,
    alert_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_alerts_created ON alerts (created_at DESC, alert_id DESC);
CREATE INDEX IF NOT EXISTS ix_alerts_host ON alerts (host_id);
CREATE INDEX IF NOT EXISTS ix_alerts_severity ON alerts (severity);

CREATE TABLE IF NOT EXISTS response_actions (
    response_id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL,
    action TEXT NOT NULL,
    tier TEXT NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'PENDING',
    target_json TEXT NOT NULL,
    command_id TEXT,
    created_at TEXT NOT NULL,
    authorized_at TEXT,
    authorized_by TEXT,
    decided_reason TEXT
);

CREATE INDEX IF NOT EXISTS ix_response_actions_state ON response_actions (lifecycle_state, created_at DESC);

CREATE TABLE IF NOT EXISTS command_audit (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id TEXT NOT NULL,
    response_id TEXT,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    outcome TEXT NOT NULL,
    details TEXT
);

CREATE TABLE IF NOT EXISTS endpoints (
    host_id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    ip_address TEXT,
    os_type TEXT,
    role TEXT,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    total_alerts INTEGER DEFAULT 0
);
