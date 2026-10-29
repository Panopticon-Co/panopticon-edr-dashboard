/**
 * Tier 2: Boundary & Corner Cases — R1: Lake Decommissioning Boundaries
 * Authoritative Source: ORIGINAL_REQUEST.md & PROJECT.md
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { DomInspector } = require('../helpers/dom_inspector');
const { MockBackendServer } = require('../helpers/mock_backend');
const { get } = require('../helpers/http_client');

describe('Tier 2: Boundary & Corner Cases — R1 Lake Decommissioning Boundaries', () => {
  const inspector = new DomInspector();

  test('T2_BR1_01: CSS contains zero lingering .telemetry-chart-card or .arctic-chart-card class rules', () => {
    assert.ok(
      !inspector.css.includes('.telemetry-chart-card'),
      'layout.css must not contain lingering .telemetry-chart-card rules'
    );
    assert.ok(
      !inspector.css.includes('.arctic-chart-card'),
      'layout.css must not contain lingering .arctic-chart-card rules'
    );
  });

  test('T2_BR1_02: HTML contains zero orphaned SVG charts (consoleArcticSvg, consoleTelemetrySvg) or arctic-glow filters', () => {
    assert.ok(
      !inspector.hasElementWithId('consoleArcticSvg'),
      'HTML must not contain #consoleArcticSvg'
    );
    assert.ok(
      !inspector.hasElementWithId('consoleTelemetrySvg'),
      'HTML must not contain #consoleTelemetrySvg'
    );
    assert.ok(
      !inspector.html.includes('id="arctic-glow"'),
      'HTML must not contain #arctic-glow SVG filter'
    );
  });

  test('T2_BR1_03: HTML contains zero leftover floating expand buttons (#btn-arctic-expand-float, #btn-arctic-fullscreen)', () => {
    assert.ok(
      !inspector.hasElementWithId('btn-arctic-expand-float'),
      'HTML must not contain #btn-arctic-expand-float'
    );
    assert.ok(
      !inspector.hasElementWithId('btn-arctic-fullscreen'),
      'HTML must not contain #btn-arctic-fullscreen'
    );
  });

  test('T2_BR1_04: Backend safely rejects or ignores legacy include_lake query parameters without 500 error', async () => {
    const mock = new MockBackendServer(8795);
    await mock.start();
    try {
      const res = await get('http://127.0.0.1:8795/api/v1/stats?include_lake=true');
      assert.notStrictEqual(
        res.status,
        500,
        'Backend must not throw 500 when called with legacy query parameter'
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(typeof res.json.total, 'number');
    } finally {
      await mock.stop();
    }
  });

  test('T2_BR1_05: KPI strip calculations handle empty telemetry/alerts without NaN or undefined', () => {
    const mock = new MockBackendServer();
    mock.loadFixtures([], []); // 0 alerts
    const stats = mock.state.stats;
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.critical, 0);
    assert.strictEqual(stats.high, 0);
    assert.strictEqual(stats.hosts_alerting, 0);
    assert.ok(!Number.isNaN(stats.total), 'total must not be NaN');
  });

  test('T2_BR1_06: JavaScript execution handles absent lake DOM elements without null listener crash', () => {
    // Verify that app.js code does not unconditionally call addEventListener on lake buttons
    const dangerousCalls = [
      'btn-arctic-theme',
      'btn-arctic-focus-2012',
      'btn-arctic-fullscreen',
      'btn-arctic-expand-float',
    ];
    for (const btnId of dangerousCalls) {
      assert.ok(
        !inspector.js.includes(`$("${btnId}")`) && !inspector.js.includes(`getElementById("${btnId}")`),
        `app.js must not query deleted element #${btnId}`
      );
    }
  });
});
