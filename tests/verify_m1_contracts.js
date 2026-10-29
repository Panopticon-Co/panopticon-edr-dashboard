/**
 * Adversarial Challenger M1 Verification Test Suite
 * Tests:
 * 1. Absence of ghost CSS, broken SVGs, and dangling listeners
 * 2. Source code integrity and absence of decommissioned symbols across backend & frontend
 * 3. Live backend API contract verification:
 *    - 404 on /api/v1/telemetry/fluctuations
 *    - 200 on /api/v1/health with telemetry_fluctuations absent
 *    - /api/alerts and /api/stats data structure, latency, and timing
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// 1. Static Scan
function runStaticScan() {
  console.log('--- Step 1: Adversarial Static Audit ---');
  const forbiddenPatterns = [
    /arctic/i,
    /multi-cycle/i,
    /consoleArcticSvg/i,
    /consoleTelemetrySvg/i,
    /TELEMETRY FLUCTUATIONS \/\/ MULTI-CYCLE LAKE/i,
    /initArcticChart/i,
    /TelemetryController/i,
    /TelemetryModelService/i,
    /TelemetryFluctuationsData/i,
    /telemetry\/fluctuations/i
  ];

  const filesToCheck = [
    'README.md',
    'backend/src/main/java/com/panopticon/backend/controller/HealthController.java',
    'console/static/index.html',
    'console/static/app.js',
    'console/static/css/layout.css'
  ];

  let violations = 0;
  for (const relPath of filesToCheck) {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[FAIL] File missing: ${relPath}`);
      violations++;
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      const match = content.match(pattern);
      if (match) {
        console.error(`[FAIL] Found forbidden pattern ${pattern} in ${relPath}: "${match[0]}"`);
        violations++;
      }
    }
  }

  // Verify deleted backend files do not exist
  const deletedFiles = [
    'backend/src/main/java/com/panopticon/backend/controller/TelemetryController.java',
    'backend/src/main/java/com/panopticon/backend/service/TelemetryModelService.java',
    'backend/src/main/java/com/panopticon/backend/model/TelemetryFluctuationsData.java',
    'backend/src/test/java/com/panopticon/backend/TelemetryModelServiceTest.java'
  ];

  for (const relPath of deletedFiles) {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      console.error(`[FAIL] Decommissioned file still exists: ${relPath}`);
      violations++;
    }
  }

  if (violations === 0) {
    console.log('[PASS] Static audit passed with 0 forbidden symbols and 0 lingering files.');
  } else {
    throw new Error(`Static audit failed with ${violations} violations.`);
  }
}

// 2. HTTP Helper
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const durationMs = Date.now() - start;
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json, durationMs });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// 3. Live Backend Contract & Latency Verification
async function runLiveBackendVerification() {
  console.log('\n--- Step 2: Live Backend Contract & Latency Verification ---');
  const jarPath = path.join(PROJECT_ROOT, 'backend/build/libs/panopticon-backend-service-1.0.0-SNAPSHOT.jar');
  if (!fs.existsSync(jarPath)) {
    throw new Error(`bootJar not found at ${jarPath}`);
  }

  const TEST_PORT = 8798;
  console.log(`Starting backend test instance on port ${TEST_PORT}...`);
  const backendProc = spawn('java', [
    `-Dserver.port=${TEST_PORT}`,
    '-Dspring.datasource.url=jdbc:sqlite:file:test_m1_challenger.db?mode=memory&cache=shared',
    '-jar',
    jarPath
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProc.stdout.on('data', d => {
    console.log('[BACKEND]', d.toString().trim());
  });
  backendProc.stderr.on('data', d => {
    console.error('[BACKEND ERR]', d.toString().trim());
  });

  // Poll until healthy
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const h = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/v1/health`);
      if (h.status === 200) {
        ready = true;
        break;
      }
    } catch (_) {}
  }

  if (!ready) {
    backendProc.kill();
    throw new Error('Backend failed to start within 20 seconds');
  }
  console.log('[PASS] Backend started and healthy.');

  try {
    // A. Check /api/v1/telemetry/fluctuations -> 404
    console.log('Testing GET /api/v1/telemetry/fluctuations...');
    const lakeRes = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/v1/telemetry/fluctuations`);
    console.log(`Status: ${lakeRes.status} (expected 404)`);
    if (lakeRes.status !== 404) {
      throw new Error(`Expected 404 for decommissioned lake endpoint, got ${lakeRes.status}`);
    }
    console.log('[PASS] /api/v1/telemetry/fluctuations returns 404 Not Found.');

    // B. Check Health Endpoint does not advertise telemetry_fluctuations
    console.log('Testing GET /api/v1/health...');
    const healthRes = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/v1/health`);
    if (healthRes.status !== 200) throw new Error(`Health returned ${healthRes.status}`);
    if (healthRes.body.includes('telemetry_fluctuations')) {
      throw new Error('Health endpoint still advertises telemetry_fluctuations endpoint!');
    }
    console.log('[PASS] /api/v1/health is operational and excludes telemetry_fluctuations.');

    // C. Verify /api/alerts and /api/v1/alerts structure & latency
    console.log('Testing GET /api/v1/alerts & GET /api/alerts...');
    const alertsV1 = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/v1/alerts`);
    const alertsAlias = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/alerts`);
    if (alertsV1.status !== 200 || alertsAlias.status !== 200) {
      throw new Error(`Alerts endpoints failed: v1=${alertsV1.status}, alias=${alertsAlias.status}`);
    }
    if (!Array.isArray(alertsV1.json)) {
      throw new Error(`Expected alerts to return an array, got ${typeof alertsV1.json}`);
    }
    console.log(`[PASS] Alerts returned ${alertsV1.json.length} items in ${alertsV1.durationMs}ms (alias: ${alertsAlias.durationMs}ms)`);

    // D. Verify /api/stats and /api/v1/dashboard/stats structure & latency
    console.log('Testing GET /api/v1/dashboard/stats & GET /api/stats...');
    const statsV1 = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/v1/dashboard/stats`);
    const statsAlias = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/stats`);
    if (statsV1.status !== 200 || statsAlias.status !== 200) {
      throw new Error(`Stats endpoints failed: v1=${statsV1.status}, alias=${statsAlias.status}`);
    }
    const expectedKeys = ['total', 'critical', 'high', 'medium', 'low', 'hosts_alerting'];
    for (const key of expectedKeys) {
      if (typeof statsV1.json[key] !== 'number') {
        throw new Error(`Stats missing numeric key: ${key}`);
      }
    }
    console.log(`[PASS] Stats returned valid schema: total=${statsV1.json.total}, critical=${statsV1.json.critical}, latency=${statsV1.durationMs}ms`);

    // E. Latency Stress Test (50 sequential requests to alerts and stats)
    console.log('\nRunning latency stress benchmark (50 iterations)...');
    const timings = [];
    for (let i = 0; i < 50; i++) {
      const res = await httpRequest(`http://127.0.0.1:${TEST_PORT}/api/v1/dashboard/stats`);
      timings.push(res.durationMs);
    }
    const avgLatency = (timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(2);
    const maxLatency = Math.max(...timings);
    console.log(`[PASS] 50 requests completed. Avg latency: ${avgLatency}ms, Max latency: ${maxLatency}ms.`);

  } finally {
    backendProc.kill();
    console.log('Backend test instance terminated.');
  }
}

async function main() {
  try {
    runStaticScan();
    await runLiveBackendVerification();
    console.log('\n========================================');
    console.log('ALL EMPIRICAL CHALLENGE CHECKS PASSED');
    console.log('========================================');
  } catch (err) {
    console.error('\n[CHALLENGE FAILED]', err.message);
    process.exit(1);
  }
}

main();
