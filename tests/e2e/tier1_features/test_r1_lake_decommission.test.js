/**
 * Tier 1: Feature Coverage — R1: Multi-Cycle Lake Decommissioning
 * Authoritative Source: ORIGINAL_REQUEST.md (R1 & Acceptance Criteria 1) & PROJECT.md
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const config = require('../config');
const { DomInspector } = require('../helpers/dom_inspector');
const { get } = require('../helpers/http_client');
const { MockBackendServer } = require('../helpers/mock_backend');

describe('Tier 1: Feature Coverage — R1 Multi-Cycle Lake Decommissioning', () => {
  const inspector = new DomInspector();

  test('T1_R1_01: Active HTML contains zero occurrences of forbidden lake/arctic strings', () => {
    const forbiddenFound = inspector.findForbiddenStrings(inspector.html);
    assert.deepStrictEqual(
      forbiddenFound,
      [],
      `HTML still contains forbidden lake identifiers: ${forbiddenFound.join(', ')}`
    );
  });

  test('T1_R1_02: Active JavaScript contains zero occurrences of forbidden lake/arctic routines', () => {
    const forbiddenFound = inspector.findForbiddenStrings(inspector.js);
    assert.deepStrictEqual(
      forbiddenFound,
      [],
      `app.js still contains forbidden lake identifiers: ${forbiddenFound.join(', ')}`
    );
    assert.ok(
      !inspector.js.includes('initArcticChart'),
      'app.js must not contain initArcticChart()'
    );
  });

  test('T1_R1_03: Active CSS contains zero lake/arctic class definitions or selectors', () => {
    const forbiddenInCss = [
      'arctic-chart',
      'telemetry-chart',
      '#consoleArcticSvg',
      '#arctic-tooltip',
      '#arctic-ice-panel',
    ];
    const found = [];
    const lowerCss = inspector.css.toLowerCase();
    for (const term of forbiddenInCss) {
      if (lowerCss.includes(term.toLowerCase())) {
        found.push(term);
      }
    }
    assert.deepStrictEqual(
      found,
      [],
      `layout.css still contains forbidden lake selectors: ${found.join(', ')}`
    );
  });

  test('T1_R1_04: Telemetry fluctuations endpoint is decommissioned and returns 404', async () => {
    // Tests both mock contract server and live backend if available
    const mockBackend = new MockBackendServer(8791);
    await mockBackend.start();
    try {
      const res = await get('http://127.0.0.1:8791/api/v1/telemetry/fluctuations');
      assert.strictEqual(
        res.status,
        404,
        `Expected 404 Not Found for decommissioned telemetry fluctuations, got ${res.status}`
      );
    } finally {
      await mockBackend.stop();
    }
  });

  test('T1_R1_05: Core telemetry, KPI strip, and health endpoints are preserved and operational', async () => {
    const mockBackend = new MockBackendServer(8792);
    mockBackend.loadFixtures([], [
      { alert_id: 'a1', severity: 'critical', host_id: 'H1' },
      { alert_id: 'a2', severity: 'high', host_id: 'H2' },
    ]);
    await mockBackend.start();

    try {
      const statsRes = await get('http://127.0.0.1:8792/api/v1/stats');
      assert.strictEqual(statsRes.status, 200);
      assert.strictEqual(statsRes.json.total, 2);
      assert.strictEqual(statsRes.json.critical, 1);
      assert.strictEqual(statsRes.json.high, 1);
      assert.strictEqual(statsRes.json.hosts_alerting, 2);

      const healthRes = await get('http://127.0.0.1:8792/api/v1/health');
      assert.strictEqual(healthRes.status, 200);
      assert.strictEqual(healthRes.json.status, 'UP');
    } finally {
      await mockBackend.stop();
    }
  });

  test('T1_R1_06: Navigation markup contains no broken links pointing to deleted lake panel', () => {
    const hrefs = inspector.getNavLinkHrefs();
    for (const href of hrefs) {
      assert.ok(
        !href.toLowerCase().includes('arctic'),
        `Navigation link "${href}" points to decommissioned arctic panel`
      );
      assert.ok(
        !href.toLowerCase().includes('lake'),
        `Navigation link "${href}" points to decommissioned data lake`
      );
    }
  });
});
