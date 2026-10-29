#!/usr/bin/env node
/**
 * Master E2E Test Suite Runner for Panopticon EDR Dashboard
 * Executes 4-tier test specifications:
 *   Tier 1: Feature Coverage (R1, R2, R3)
 *   Tier 2: Boundary & Corner Cases
 *   Tier 3: Cross-Feature Combinations (Pairwise)
 *   Tier 4: Real-World Scenarios (Analyst Workflows)
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const E2E_ROOT = __dirname;

const TEST_FILES = {
  tier1: [
    path.join(E2E_ROOT, 'tier1_features', 'test_r1_lake_decommission.test.js'),
    path.join(E2E_ROOT, 'tier1_features', 'test_r2_response_engine.test.js'),
    path.join(E2E_ROOT, 'tier1_features', 'test_r3_slide_navigation.test.js'),
  ],
  tier2: [
    path.join(E2E_ROOT, 'tier2_boundaries', 'test_r1_lake_boundaries.test.js'),
    path.join(E2E_ROOT, 'tier2_boundaries', 'test_r2_response_boundaries.test.js'),
    path.join(E2E_ROOT, 'tier2_boundaries', 'test_r3_slide_boundaries.test.js'),
  ],
  tier3: [
    path.join(E2E_ROOT, 'tier3_combinations', 'test_pairwise_interactions.test.js'),
  ],
  tier4: [
    path.join(E2E_ROOT, 'tier4_real_world', 'test_analyst_workflows.test.js'),
  ],
};

function parseArgs() {
  const args = process.argv.slice(2);
  let tier = 'all';
  let reportOnly = false;

  for (const arg of args) {
    if (arg === '--tier=1' || arg === '1' || arg === '-1') tier = 'tier1';
    else if (arg === '--tier=2' || arg === '2' || arg === '-2') tier = 'tier2';
    else if (arg === '--tier=3' || arg === '3' || arg === '-3') tier = 'tier3';
    else if (arg === '--tier=4' || arg === '4' || arg === '-4') tier = 'tier4';
    else if (arg === '--all' || arg === 'all') tier = 'all';
    else if (arg === '--report' || arg === '--no-fail') reportOnly = true;
  }

  return { tier, reportOnly };
}

async function runFile(filePath) {
  return new Promise((resolve) => {
    const relativePath = path.relative(path.resolve(E2E_ROOT, '..', '..'), filePath);
    const proc = spawn(process.execPath, ['--test', filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      // Parse output for tests, pass, fail
      const passMatch = /ℹ pass (\d+)/.exec(stdout);
      const failMatch = /ℹ fail (\d+)/.exec(stdout);
      const totalMatch = /ℹ tests (\d+)/.exec(stdout);

      const pass = passMatch ? parseInt(passMatch[1], 10) : 0;
      const fail = failMatch ? parseInt(failMatch[1], 10) : (code !== 0 ? 1 : 0);
      const total = totalMatch ? parseInt(totalMatch[1], 10) : pass + fail;

      resolve({
        file: relativePath,
        code,
        total,
        pass,
        fail,
        stdout,
        stderr,
      });
    });
  });
}

async function main() {
  const { tier, reportOnly } = parseArgs();
  console.log('='.repeat(70));
  console.log(`PANOPTICON EDR DASHBOARD — E2E TEST SUITE RUNNER`);
  console.log(`Mode: Target Tier = ${tier.toUpperCase()}`);
  console.log('='.repeat(70));

  let filesToRun = [];
  if (tier === 'all') {
    filesToRun = [
      ...TEST_FILES.tier1,
      ...TEST_FILES.tier2,
      ...TEST_FILES.tier3,
      ...TEST_FILES.tier4,
    ];
  } else if (TEST_FILES[tier]) {
    filesToRun = TEST_FILES[tier];
  } else {
    console.error(`Unknown tier: ${tier}`);
    process.exit(1);
  }

  const results = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const f of filesToRun) {
    const rel = path.relative(E2E_ROOT, f);
    process.stdout.write(`Running [${rel}] ... `);
    const res = await runFile(f);
    results.push(res);
    totalTests += res.total;
    totalPassed += res.pass;
    totalFailed += res.fail;

    if (res.code === 0) {
      console.log(`\x1b[32mPASS\x1b[0m (${res.pass}/${res.total})`);
    } else {
      console.log(`\x1b[31mFAIL\x1b[0m (${res.pass}/${res.total} passed, ${res.fail} failed)`);
    }
  }

  console.log('-'.repeat(70));
  console.log('TEST SUITE SUMMARY');
  console.log('-'.repeat(70));
  console.log(`Total Files Executed: ${results.length}`);
  console.log(`Total Test Cases:     ${totalTests}`);
  console.log(`Passed:               \x1b[32m${totalPassed}\x1b[0m`);
  console.log(`Failed:               ${totalFailed > 0 ? `\x1b[31m${totalFailed}\x1b[0m` : '0'}`);
  console.log(`Pass Rate:            ${((totalPassed / (totalTests || 1)) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));

  // Detail failures if any
  if (totalFailed > 0) {
    console.log('\nFAILURE DETAILS / MILESTONE GAPS DETECTED:');
    for (const r of results) {
      if (r.fail > 0) {
        console.log(`\n--- ${r.file} ---`);
        const failLines = r.stdout
          .split('\n')
          .filter((line) => line.includes('✖') || line.includes('AssertionError'))
          .slice(0, 10);
        console.log(failLines.join('\n'));
      }
    }
  }

  if (!reportOnly && totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
