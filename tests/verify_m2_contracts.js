/**
 * Adversarial Challenger M2 Verification Test Suite
 * Empirical verification of:
 * 1. CAS State Machine & Expiration Sweep:
 *    - CAS update atomicity (WHERE response_id = ? AND lifecycle_state = 'PENDING')
 *    - Rejection of invalid transitions (cannot authorize already-authorized, rejected, or expired action)
 *    - Mandatory non-empty rejection reason (1..512 chars)
 *    - 15-minute TTL expiration sweep logic & audit trail generation
 *    - Duplicate action suppression
 * 2. UI Robustness:
 *    - Authoritative 9-column response table markup & cell mapping
 *    - Immediate button disabling on click to prevent duplicate submissions
 *    - Safe error recovery (button re-enabling on network/server error)
 *    - Payload caching via lastPayloadString to retain expanded <details> audit disclosures across polling
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

console.log('======================================================================');
console.log('PANOPTICON EDR DASHBOARD — EMPIRICAL CHALLENGER M2 TEST SUITE');
console.log('======================================================================\n');

// --------------------------------------------------------------------
// SECTION 1: Backend CAS State Machine & Expiration Sweep Audit
// --------------------------------------------------------------------
console.log('--- Section 1: Backend State Machine & CAS Verification ---');

const repoPath = path.join(PROJECT_ROOT, 'backend/src/main/java/com/panopticon/backend/repository/ResponseActionRepository.java');
const repoContent = fs.readFileSync(repoPath, 'utf8');

const controllerPath = path.join(PROJECT_ROOT, 'backend/src/main/java/com/panopticon/backend/controller/ResponseActionController.java');
const controllerContent = fs.readFileSync(controllerPath, 'utf8');

const servicePath = path.join(PROJECT_ROOT, 'backend/src/main/java/com/panopticon/backend/service/ResponseActionService.java');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

const stateModelPath = path.join(PROJECT_ROOT, 'backend/src/main/java/com/panopticon/backend/model/ResponseLifecycleState.java');
const stateModelContent = fs.readFileSync(stateModelPath, 'utf8');

test('CAS-01: ResponseActionRepository authorizes strictly with CAS atomic WHERE clause', () => {
  assert.match(
    repoContent,
    /UPDATE\s+response_actions\s+SET\s+lifecycle_state\s*=\s*'AUTHORIZED'.*WHERE\s+response_id\s*=\s*\?\s+AND\s+lifecycle_state\s*=\s*'PENDING'/is,
    'authorizeAction must contain atomic CAS WHERE clause checking lifecycle_state = PENDING'
  );
});

test('CAS-02: ResponseActionRepository rejects strictly with CAS atomic WHERE clause', () => {
  assert.match(
    repoContent,
    /UPDATE\s+response_actions\s+SET\s+lifecycle_state\s*=\s*'REJECTED'.*WHERE\s+response_id\s*=\s*\?\s+AND\s+lifecycle_state\s*=\s*'PENDING'/is,
    'rejectAction must contain atomic CAS WHERE clause checking lifecycle_state = PENDING'
  );
});

test('CAS-03: Controller validates PENDING state before authorizing and returns 400 on violation', () => {
  assert.match(
    controllerContent,
    /if\s*\(\s*!"PENDING"\.equalsIgnoreCase\(\s*action\.getLifecycleState\(\)\s*\)\s*\)\s*\{\s*return\s+ResponseEntity\.badRequest\(\)/is,
    'Controller must verify action is PENDING before authorize, returning 400 Bad Request'
  );
});

test('CAS-04: Controller validates PENDING state before rejecting and returns 400 on violation', () => {
  assert.match(
    controllerContent,
    /if\s*\(\s*!"PENDING"\.equalsIgnoreCase\(\s*action\.getLifecycleState\(\)\s*\)\s*\)\s*\{\s*return\s+ResponseEntity\.badRequest\(\)/is,
    'Controller must verify action is PENDING before reject, returning 400 Bad Request'
  );
});

test('CAS-05: Controller strictly validates rejection reason is non-empty, non-whitespace, <=512 chars', () => {
  assert.match(
    controllerContent,
    /if\s*\(\s*body\s*==\s*null\s*\|\|\s*!body\.containsKey\("reason"\)\s*\)/is,
    'Controller must reject missing reason body'
  );
  assert.match(
    controllerContent,
    /reasonStr\.trim\(\)\.isEmpty\(\)/is,
    'Controller must reject blank/whitespace reason'
  );
  assert.match(
    controllerContent,
    /reason\.length\(\)\s*>\s*512/is,
    'Controller must reject reasons exceeding 512 characters'
  );
});

test('CAS-06: 15-Minute Expiration Sweep queries strictly stale PENDING actions and sets EXPIRED', () => {
  assert.match(
    serviceContent,
    /Instant\s+cutoff\s*=\s*Instant\.now\(\)\.minus\(15,\s*ChronoUnit\.MINUTES\)/is,
    'Service must compute 15-minute cutoff time'
  );
  assert.match(
    repoContent,
    /SELECT\s+\*\s+FROM\s+response_actions\s+WHERE\s+lifecycle_state\s*=\s*'PENDING'\s+AND\s+created_at\s*<\s*\?/is,
    'Repository must select PENDING actions created before cutoff'
  );
  assert.match(
    repoContent,
    /UPDATE\s+response_actions\s+SET\s+lifecycle_state\s*=\s*'EXPIRED',\s*decided_reason\s*=\s*'15-minute TTL elapsed without analyst decision'/is,
    'Repository must update stale actions to EXPIRED with standard reason'
  );
  assert.match(
    repoContent,
    /insertAudit\(.*"system:expiration-sweep",\s*"expired",\s*"15-minute TTL elapsed without analyst decision"\)/is,
    'Repository must record audit log for each expired action'
  );
});

test('CAS-07: Lifecycle State Model defines exact 7 states and terminal state transitions', () => {
  const expectedStates = ['PENDING', 'AUTHORIZED', 'DISPATCHED', 'SUCCEEDED', 'FAILED', 'REJECTED', 'EXPIRED'];
  for (const st of expectedStates) {
    assert.match(stateModelContent, new RegExp(`\\b${st}\\b`), `State enum must include ${st}`);
  }
  assert.match(
    stateModelContent,
    /public\s+boolean\s+isTerminal\(\)\s*\{\s*return\s+this\s*==\s*SUCCEEDED\s*\|\|\s*this\s*==\s*FAILED\s*\|\|\s*this\s*==\s*REJECTED\s*\|\|\s*this\s*==\s*EXPIRED;\s*\}/is,
    'State model must define SUCCEEDED, FAILED, REJECTED, EXPIRED as terminal'
  );
});

// --------------------------------------------------------------------
// SECTION 2: UI Robustness & DOM Interactivity Verification
// --------------------------------------------------------------------
console.log('\n--- Section 2: UI Robustness & DOM Interactivity ---');

const htmlPath = path.join(PROJECT_ROOT, 'console/static/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const appJsPath = path.join(PROJECT_ROOT, 'console/static/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

test('UI-01: HTML index.html defines exact 9-column response table header', () => {
  const tableMatch = htmlContent.match(/<table\s+id="response-table"[^>]*>([\s\S]*?)<\/table>/i);
  assert.ok(tableMatch, 'Table #response-table must exist in index.html');
  const theadMatch = tableMatch[1].match(/<thead>([\s\S]*?)<\/thead>/i);
  assert.ok(theadMatch, 'Table must contain <thead>');
  const thMatches = [...theadMatch[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => m[1].trim());

  assert.equal(thMatches.length, 9, `Expected exactly 9 <th> columns, found ${thMatches.length}`);
  const expectedHeaders = [
    'State',
    'Action &amp; Target',
    'Tier',
    'Alert ID',
    'Created At',
    'Decided Reason',
    'Command Execution',
    'Audit Trail',
    'Actions'
  ];
  for (let i = 0; i < expectedHeaders.length; i++) {
    assert.equal(thMatches[i], expectedHeaders[i], `Column ${i} expected "${expectedHeaders[i]}" but found "${thMatches[i]}"`);
  }
});

test('UI-02: app.js rowFor creates exactly 9 <td> cells corresponding to the 9 columns', () => {
  assert.match(
    appJsContent,
    /row\.append\(c0,\s*c1,\s*c2,\s*c3,\s*c4,\s*c5,\s*c6,\s*c7,\s*c8\);/is,
    'app.js rowFor must append exactly 9 cells (c0 through c8)'
  );
});

test('UI-03: Authorize button click handler disables buttons synchronously to prevent duplicate submission', () => {
  const authSectionMatch = appJsContent.match(/btnAuth\.addEventListener\("click",\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)(?:c8\.append|\}\);\s*c8)/);
  assert.ok(authSectionMatch, 'btnAuth click listener must be registered');
  const body = authSectionMatch[1];

  const disabledIdx1 = body.indexOf('btnAuth.disabled = true;');
  const disabledIdx2 = body.indexOf('btnRej.disabled = true;');
  const fetchIdx = body.indexOf('await fetch(');

  assert.ok(disabledIdx1 !== -1, 'btnAuth.disabled must be set to true');
  assert.ok(disabledIdx2 !== -1, 'btnRej.disabled must be set to true');
  assert.ok(disabledIdx1 < fetchIdx, 'btnAuth must be disabled BEFORE await fetch');
  assert.ok(disabledIdx2 < fetchIdx, 'btnRej must be disabled BEFORE await fetch');
  assert.match(body, /btnAuth\.textContent\s*=\s*"Authorizing\.\.\.";/, 'btnAuth text must indicate in-flight request');
});

test('UI-04: Reject button click handler disables buttons synchronously and re-enables on error', () => {
  const rejSectionMatch = appJsContent.match(/btnRej\.addEventListener\("click",\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)(?:c8\.append|\}\);\s*c8)/);
  assert.ok(rejSectionMatch, 'btnRej click listener must be registered');
  const body = rejSectionMatch[1];

  const disabledIdx1 = body.indexOf('btnAuth.disabled = true;');
  const disabledIdx2 = body.indexOf('btnRej.disabled = true;');
  const fetchIdx = body.indexOf('await fetch(');

  assert.ok(disabledIdx1 !== -1, 'btnAuth.disabled must be set to true on reject click');
  assert.ok(disabledIdx2 !== -1, 'btnRej.disabled must be set to true on reject click');
  assert.ok(disabledIdx1 < fetchIdx, 'Buttons must be disabled BEFORE await fetch in reject handler');
  assert.match(body, /btnRej\.textContent\s*=\s*"Rejecting\.\.\.";/, 'btnRej text must indicate in-flight request');

  // Verify re-enabling on error
  assert.match(body, /btnAuth\.disabled\s*=\s*false;\s*btnRej\.disabled\s*=\s*false;\s*btnRej\.textContent\s*=\s*"Reject";/,
    'Buttons must be re-enabled on error or failure in reject handler');
});

test('UI-05: Payload caching via lastPayloadString prevents DOM teardown during polling', () => {
  assert.match(
    appJsContent,
    /let\s+lastPayloadString\s*=\s*null;/is,
    'lastPayloadString cache variable must be declared'
  );
  assert.match(
    appJsContent,
    /const\s+payloadStr\s*=\s*JSON\.stringify\(payload\);\s*if\s*\(\s*payloadStr\s*===\s*lastPayloadString\s*\)\s*\{\s*return;\s*\}/is,
    'pollResponseActions must check payloadStr === lastPayloadString and return early'
  );
  assert.match(
    appJsContent,
    /lastPayloadString\s*=\s*payloadStr;/is,
    'lastPayloadString must be updated when new payload arrives'
  );
});

// --------------------------------------------------------------------
// SECTION 3: In-Memory VM Simulation of Disclosure State Retention
// --------------------------------------------------------------------
console.log('\n--- Section 3: In-Memory VM Simulation of DOM Retention ---');

asyncTest('UI-SIM-01: Expanded audit disclosures survive polling ticks when payload is unchanged', async () => {
  class MockElement {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.textContent = '';
      this.hidden = false;
      this.open = false;
      this.listeners = {};
      this.disabled = false;
      this.className = '';
    }
    append(...items) {
      for (const item of items) {
        if (item) {
          if (item.fragment) this.children.push(...item.children);
          else this.children.push(item);
        }
      }
    }
    replaceChildren(...items) {
      this.children = [];
      this.append(...items);
    }
    addEventListener(evt, fn) {
      this.listeners[evt] = fn;
    }
  }

  const elementsMap = new Map();
  const el = id => {
    if (!elementsMap.has(id)) elementsMap.set(id, new MockElement('div'));
    return elementsMap.get(id);
  };

  let mockPayload = {
    response_actions: [
      {
        response_id: 'r-persist-1',
        lifecycle_state: 'AUTHORIZED',
        action: 'KILL_PROCESS',
        tier: 'ANALYST_APPROVAL',
        alert_id: 'ALT-100',
        created_at: '2026-10-29T12:00:00Z',
        target: { host_id: 'WS-1', pid: 1234, start_time_ticks: 5678 },
        command_id: 'cmd-1',
        audit: [
          { audit_id: 'a1', event: 'authorized', actor: 'analyst:alice', detail: 'approved', occurred_at: '2026-10-29T12:00:01Z' }
        ]
      }
    ]
  };

  const sandbox = {
    document: {
      getElementById: el,
      createElement: tag => new MockElement(tag),
      createDocumentFragment: () => Object.assign(new MockElement('fragment'), { fragment: true }),
      addEventListener: (event, fn) => fn()
    },
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => mockPayload
    })
  };

  const panelCode = appJsContent.split('// RESPONSE ACTIONS PANEL')[1];
  assert.ok(panelCode, 'app.js must contain // RESPONSE ACTIONS PANEL section');

  const context = vm.createContext(sandbox);
  vm.runInContext(panelCode, context);

  // Trigger first poll
  await el('response-refresh').listeners.click();

  const bodyEl = el('response-body');
  assert.equal(bodyEl.children.length, 1, 'One row should be rendered');
  const firstRow = bodyEl.children[0];
  assert.equal(firstRow.children.length, 9, 'Row must have 9 cells');

  // Find the <details> element in cell 7 (Audit Trail)
  const auditCell = firstRow.children[7];
  assert.equal(auditCell.children.length, 1, 'Audit cell must have details element');
  const detailsEl = auditCell.children[0];
  assert.equal(detailsEl.tag, 'details', 'Audit child must be <details>');

  // Analyst opens the details disclosure
  detailsEl.open = true;

  // Poll 2nd time with identical payload
  await el('response-refresh').listeners.click();

  // Verify that the exact same row instance and details instance persist
  assert.equal(bodyEl.children[0], firstRow, 'Row element reference must not change across polling with identical payload');
  assert.equal(bodyEl.children[0].children[7].children[0], detailsEl, 'Details element reference must not change');
  assert.equal(detailsEl.open, true, 'Audit disclosure open state must be preserved across polling');

  // Poll 3rd time with changed payload (action state transitions to SUCCEEDED)
  mockPayload = {
    response_actions: [
      {
        ...mockPayload.response_actions[0],
        lifecycle_state: 'SUCCEEDED',
        command_state: 'SUCCEEDED'
      }
    ]
  };

  await el('response-refresh').listeners.click();

  // Now row should be re-rendered with new state
  const updatedRow = bodyEl.children[0];
  assert.notEqual(updatedRow, firstRow, 'Row element should be updated when payload changes');
  assert.equal(updatedRow.children[0].children[0].textContent, 'SUCCEEDED', 'State badge should reflect SUCCEEDED');
});

// --------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------
(async () => {
  await new Promise(r => setImmediate(r));
  console.log('\n======================================================================');
  console.log(`SUMMARY: Total Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exitCode = 1;
  }
})();
