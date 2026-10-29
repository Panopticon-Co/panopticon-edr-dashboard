/**
 * Panopticon EDR Dashboard - E2E Test Suite Configuration
 * Strictly adheres to ORIGINAL_REQUEST.md and PROJECT.md specifications.
 */
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  PROJECT_ROOT,
  CONSOLE_DIR: path.join(PROJECT_ROOT, 'console'),
  BACKEND_DIR: path.join(PROJECT_ROOT, 'backend'),
  STATIC_DIR: path.join(PROJECT_ROOT, 'console', 'static'),
  INDEX_HTML: path.join(PROJECT_ROOT, 'console', 'static', 'index.html'),
  APP_JS: path.join(PROJECT_ROOT, 'console', 'static', 'app.js'),
  LAYOUT_CSS: path.join(PROJECT_ROOT, 'console', 'static', 'css', 'layout.css'),
  TOKENS_CSS: path.join(PROJECT_ROOT, 'console', 'static', 'css', 'tokens.css'),
  ALERTS_NDJSON: path.join(PROJECT_ROOT, 'console', 'alerts.ndjson'),

  // Service Ports
  PROXY_PORT: parseInt(process.env.PANOPTICON_PROXY_PORT || '8787', 10),
  BACKEND_PORT: parseInt(process.env.PANOPTICON_BACKEND_PORT || '8788', 10),
  MOCK_BACKEND_PORT: parseInt(process.env.PANOPTICON_MOCK_BACKEND_PORT || '8798', 10),

  PROXY_BASE_URL: process.env.PANOPTICON_PROXY_URL || 'http://127.0.0.1:8787',
  BACKEND_BASE_URL: process.env.PANOPTICON_BACKEND_URL || 'http://127.0.0.1:8788',

  MANAGER_TOKEN: process.env.PANOPTICON_MANAGER_TOKEN || 'mock-analyst-token',

  // Policy & Vocabulary
  CLOSED_ACTIONS: [
    'KILL_PROCESS',
    'COLLECT_PROCESS_INFO',
    'COLLECT_NETWORK_CONNECTIONS',
    'COLLECT_FILE',
    'QUARANTINE_FILE',
    'ISOLATE_HOST',
    'RELEASE_HOST_ISOLATION',
  ],

  DESTRUCTIVE_ACTIONS: [
    'KILL_PROCESS',
    'ISOLATE_HOST',
    'RELEASE_HOST_ISOLATION',
  ],

  POLICY_TIERS: {
    AUTO_SAFE: ['COLLECT_PROCESS_INFO', 'COLLECT_NETWORK_CONNECTIONS'],
    ANALYST_APPROVAL: [
      'KILL_PROCESS',
      'COLLECT_FILE',
      'QUARANTINE_FILE',
      'ISOLATE_HOST',
      'RELEASE_HOST_ISOLATION',
    ],
  },

  LIFECYCLE_STATES: [
    'PENDING',
    'AUTHORIZED',
    'DISPATCHED',
    'SUCCEEDED',
    'FAILED',
    'REJECTED',
    'EXPIRED',
  ],

  // Forbidden Lake / Arctic identifiers (R1 Acceptance Criteria)
  FORBIDDEN_LAKE_STRINGS: [
    'arctic',
    'multi-cycle',
    'consolearcticsvg',
    'consoletelemetrysvg',
    'fleet telemetry fluctuations // multi-cycle lake',
  ],

  // Slide definitions (R3 Acceptance Criteria)
  EXPECTED_SLIDES: [
    { index: 0, id: 'panel-overview', label: 'Overview' },
    { index: 1, id: 'panel-endpoints', label: 'Endpoints' },
    { index: 2, id: 'panel-alerts', label: 'Alerts' },
    { index: 3, id: 'panel-response', label: 'Response Queue' },
  ],
};
