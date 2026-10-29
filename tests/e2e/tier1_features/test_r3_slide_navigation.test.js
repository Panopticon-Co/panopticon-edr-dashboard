/**
 * Tier 1: Feature Coverage — R3: Slide-Based Navigation
 * Authoritative Source: ORIGINAL_REQUEST.md (R3 & Acceptance Criteria 3) & PROJECT.md
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { DomInspector } = require('../helpers/dom_inspector');

describe('Tier 1: Feature Coverage — R3 Slide-Based Navigation', () => {
  const inspector = new DomInspector();

  test('T1_R3_01: Exactly 4 logical fullscreen panel sections are structured in HTML', () => {
    // 4 slides: Overview, Endpoints, Alerts, Response Queue
    const expectedIds = ['panel-overview', 'panel-endpoints', 'panel-alerts', 'panel-response'];
    const foundPanels = [];
    for (const id of expectedIds) {
      if (inspector.hasElementWithId(id) || inspector.hasString(inspector.html, id)) {
        foundPanels.push(id);
      }
    }
    assert.strictEqual(
      foundPanels.length,
      4,
      `Expected 4 slide panels, found ${foundPanels.length}: [${foundPanels.join(', ')}]`
    );
  });

  test('T1_R3_02: Sidebar navigation links provide direct routing to each panel', () => {
    const hrefs = inspector.getNavLinkHrefs();
    const expectedTargets = ['overview', 'endpoints', 'alerts', 'response'];
    for (const target of expectedTargets) {
      const hasTarget = hrefs.some((h) => h.includes(target));
      assert.ok(
        hasTarget,
        `Sidebar navigation is missing link for target slide: ${target}`
      );
    }
  });

  test('T1_R3_03: Next and Previous slide navigation buttons are present in DOM', () => {
    const controls = inspector.hasSlideNavigationControls();
    assert.ok(
      controls.hasPrevButton,
      'Previous slide button (#btn-slide-prev) is missing from markup'
    );
    assert.ok(
      controls.hasNextButton,
      'Next slide button (#btn-slide-next) is missing from markup'
    );
  });

  test('T1_R3_04: Keyboard navigation handlers for ArrowLeft/ArrowRight/ArrowUp/ArrowDown exist in app.js', () => {
    // Check app.js for Arrow key listeners
    const hasArrowRight = inspector.js.includes('ArrowRight');
    const hasArrowLeft = inspector.js.includes('ArrowLeft');
    const hasArrowDown = inspector.js.includes('ArrowDown');
    const hasArrowUp = inspector.js.includes('ArrowUp');

    assert.ok(
      hasArrowRight && hasArrowLeft,
      'app.js must register keydown handlers for ArrowRight and ArrowLeft slide navigation'
    );
    assert.ok(
      hasArrowDown && hasArrowUp,
      'app.js must register keydown handlers for ArrowDown and ArrowUp slide navigation'
    );
  });

  test('T1_R3_05: Slide transition animations specify smooth easing with duration under 300ms', () => {
    const durations = inspector.getTransitionDurationMs();
    assert.ok(
      durations.length > 0,
      'layout.css must declare transition durations for slide transitions'
    );
    // Every slide transition duration must be < 300ms
    for (const d of durations) {
      assert.ok(
        d <= 300,
        `Slide transition duration ${d}ms exceeds the required <300ms ceiling`
      );
    }
  });

  test('T1_R3_06: CSS specifies prefers-reduced-motion: reduce to immediately disable animations', () => {
    const hasReducedMotion = inspector.hasReducedMotionQuery();
    assert.ok(
      hasReducedMotion,
      'layout.css must declare a @media (prefers-reduced-motion: reduce) rule'
    );

    const rules = inspector.getReducedMotionRules();
    assert.ok(
      rules && (rules.includes('0ms') || rules.includes('0s') || rules.includes('none')),
      `Reduced motion rule must set transition duration to 0ms/none, found: ${rules}`
    );
  });
});
