# Panopticon EDR Dashboard — E2E Test Infrastructure

## Overview
The Panopticon EDR Dashboard E2E test infrastructure provides comprehensive, opaque-box end-to-end verification across the entire platform. Designed in accordance with `ORIGINAL_REQUEST.md` and `PROJECT.md`, it strictly adheres to the 4-tier testing methodology without relying on internal classes or leaky abstractions. Tests exercise the platform via CLI, HTTP requests (:8787 console proxy and :8788 backend), and DOM/CSS/JS inspection.

## Architecture
```
tests/e2e/
├── runner.js                      # Master CLI runner with tier selection & reporting
├── runner.py                      # Cross-platform Python launcher
├── config.js                      # Ports, paths, token, closed action allowlists, expected slides
├── helpers/
│   ├── http_client.js             # Native fetch HTTP client with timeouts & header management
│   ├── dom_inspector.js           # Static & DOM asset inspector (HTML, CSS, JS rules & tokens)
│   ├── mock_backend.js            # Port 8788 REST contract server (dual routing, CAS, TTL, audit)
│   ├── mock_proxy.js              # Port 8787 Console Proxy server (CSP, same-origin relay)
│   └── test_fixtures.js           # Authoritative alerts, 7-action models, and audit logs
├── tier1_features/
│   ├── test_r1_lake_decommission.test.js  # R1 Feature Coverage (6 tests)
│   ├── test_r2_response_engine.test.js    # R2 Feature Coverage (7 tests)
│   └── test_r3_slide_navigation.test.js   # R3 Feature Coverage (6 tests)
├── tier2_boundaries/
│   ├── test_r1_lake_boundaries.test.js    # R1 Boundaries & Edge Cases (6 tests)
│   ├── test_r2_response_boundaries.test.js # R2 Boundaries, TTL, & CAS (8 tests)
│   └── test_r3_slide_boundaries.test.js   # R3 Boundaries & Reduced Motion (6 tests)
├── tier3_combinations/
│   └── test_pairwise_interactions.test.js # Pairwise cross-feature flows (6 tests)
└── tier4_real_world/
    └── test_analyst_workflows.test.js     # Real-world SOC analyst workflows (4 tests)
```

## 4-Tier Test Methodology

### Tier 1: Feature Coverage (19 Test Cases)
- **R1: Multi-Cycle Lake Decommissioning** (6 tests):
  - Zero occurrences of `arctic`, `multi-cycle`, `consoleArcticSvg`, `consoleTelemetrySvg`, or `FLEET TELEMETRY FLUCTUATIONS // MULTI-CYCLE LAKE` in HTML, JS, or CSS.
  - Verification that `/api/v1/telemetry/fluctuations` returns 404 Not Found.
  - Continuity of core telemetry, KPI strip, and health endpoints.
  - Absence of broken subnav links to lake panel.
- **R2: Response Engine Integration** (7 tests):
  - Strict enforcement of the closed 7-action vocabulary allowlist.
  - Policy tier classification (`AUTO_SAFE` vs `ANALYST_APPROVAL`).
  - Target schema validation (`pid > 0`, `start_time_ticks > 0` for process; `path` for file; `{}` for host).
  - Lifecycle state machine transitions across canonical 7 states.
  - Destructive action safeguards forbidding auto-execution for `KILL_PROCESS`, `ISOLATE_HOST`, `RELEASE_HOST_ISOLATION`.
  - Console proxy relaying of `/authorize` and `/reject` with `PANOPTICON_MANAGER_TOKEN`.
  - Frontend 9-column response table compliance.
- **R3: Slide-Based Navigation** (6 tests):
  - Verification of 4 fullscreen slide panel sections in HTML.
  - Sidebar navigation links for Overview, Endpoints, Alerts, Response Queue.
  - Header previous and next button controls (`#btn-slide-prev`, `#btn-slide-next`).
  - Keyboard arrow key navigation bindings (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`).
  - Transition duration ceiling under 300ms easing.
  - Reduced-motion accessibility rule `@media (prefers-reduced-motion: reduce)`.

### Tier 2: Boundary & Corner Cases (20 Test Cases)
- **R1 Boundaries** (6 tests): Lingering CSS chart classes, orphaned SVG markup and filters, floating expand buttons, legacy query parameters, empty alert KPI edge cases, and absent DOM elements error tolerance.
- **R2 Boundaries** (8 tests): Unknown action rejection, negative/zero PID rejection, empty or overlong file path rejection (>4096 chars), empty or whitespace-only reject reason (400), overlong reject reason (>512 chars, 400), duplicate authorization on decided actions (CAS failure), 15-minute TTL expiration sweep, and duplicate action deduplication.
- **R3 Boundaries** (6 tests): Lower index boundary clamp at slide 0, upper index boundary clamp at slide 3, rapid successive navigation input resilience, invalid URL hash fallback to slide 0, reduced-motion specificity, and viewport resizing layout stability.

### Tier 3: Cross-Feature Combinations (6 Test Cases)
- `T3_C01`: Ingestion -> Recommendation -> Proxy Authorize -> State Machine Update -> Command Audit Log.
- `T3_C02`: Ingestion -> Destructive Recommendation -> Proxy Reject with Mandatory Reason -> Audit Log & Table Reason Display.
- `T3_C03`: Stale Action 15-Minute Expiration Sweep -> Dynamic UI Polling Update -> Badge Refresh.
- `T3_C04`: Navigation State Preservation During Background Polling and Nav Badge Synchronization.
- `T3_C05`: Lake Decommissioning Coexists with Shared Fleet KPI Calculation Continuity.
- `T3_C06`: AUTO_SAFE Fast-Track Execution vs ANALYST_APPROVAL Manual Gate Coexistence.

### Tier 4: Real-World Scenarios (4 Test Cases)
- `T4_S01`: High-Entropy Obfuscated PowerShell Incident Triage & `KILL_PROCESS` Workflow.
- `T4_S02`: Domain Controller `ISOLATE_HOST` Rejection Workflow with Mandatory Justification & Audit.
- `T4_S03`: AUTO_SAFE Fast-Track Forensic Collection & 3-Event Command Audit Verification (`created`, `delivered`, `result_received`).
- `T4_S04`: SOC Shift Handover & Multi-Panel Accessibility Audit with Reduced Motion.

---

## How to Run the Tests

### Quick Execution
```powershell
# Run the entire E2E test suite
node tests/e2e/runner.js

# Or using the Python wrapper
python tests/e2e/runner.py

# Run in reporting mode (does not exit with error on failures)
node tests/e2e/runner.js --report
```

### Running Specific Tiers
```powershell
# Tier 1 only (Feature Coverage)
node tests/e2e/runner.js --tier=1

# Tier 2 only (Boundaries & Edge Cases)
node tests/e2e/runner.js --tier=2

# Tier 3 only (Pairwise Cross-Feature)
node tests/e2e/runner.js --tier=3

# Tier 4 only (Real-World Scenarios)
node tests/e2e/runner.js --tier=4
```

### Running Individual Test Files with Node Test Runner
```powershell
node --test tests/e2e/tier1_features/test_r1_lake_decommission.test.js
node --test tests/e2e/tier1_features/test_r2_response_engine.test.js
node --test tests/e2e/tier1_features/test_r3_slide_navigation.test.js
node --test tests/e2e/tier2_boundaries/test_r1_lake_boundaries.test.js
node --test tests/e2e/tier2_boundaries/test_r2_response_boundaries.test.js
node --test tests/e2e/tier2_boundaries/test_r3_slide_boundaries.test.js
node --test tests/e2e/tier3_combinations/test_pairwise_interactions.test.js
node --test tests/e2e/tier4_real_world/test_analyst_workflows.test.js
```

---

## Current Status & Milestone Gap Analysis
- Total Test Cases: **49**
- Passing: **39** (79.6%)
- Failing: **10** (20.4%)

### Passing Areas (Complete)
- **R1: Multi-Cycle Lake Decommissioning**: 100% PASS (all 12 feature and boundary tests pass against M1 completed implementation).
- **R2: Response Engine Backend Core & Boundaries**: 100% PASS for closed 7-action allowlist, policy tiers, target validation, CAS checks, 15m expiration sweep, deduplication, and proxy relays.
- **Tier 3: Pairwise Interactions**: 100% PASS (all 6 cross-feature flows verified).
- **Tier 4: Workflows**: 75% PASS (T4_S01, T4_S02, T4_S03 verified).

### Failing Areas (Pending M2 / M3 Implementation)
The 10 failing tests precisely track features scheduled for M2 and M3:
1. `T1_R2_07`: Response Table 9-Column Contract (currently has 6 columns; M2 pending).
2. `T1_R3_01`: 4 Fullscreen Slide Panels (currently 1 slide panel; M3 pending).
3. `T1_R3_03`: Next/Previous Buttons in DOM (M3 pending).
4. `T1_R3_04`: Arrow Key Navigation Listeners in `app.js` (M3 pending).
5. `T1_R3_06`: `@media (prefers-reduced-motion: reduce)` in `layout.css` (M3 pending).
6. `T2_BR3_01`: Slide 0 Lower Boundary Clamp (M3 pending).
7. `T2_BR3_03`: Centralized Slide Transition Routine (M3 pending).
8. `T2_BR3_04`: URL Hash Routing to Slide 0 Fallback (M3 pending).
9. `T2_BR3_05`: Reduced-Motion CSS Specificity (M3 pending).
10. `T4_S04`: Multi-Panel Shift Handover Reduced-Motion (M3 pending).
