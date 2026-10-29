/**
 * DOM and Static Asset Inspector for Panopticon E2E Tests
 * Inspects index.html, layout.css, and app.js structures and rules
 * without requiring heavy browser binaries.
 */
const fs = require('node:fs');
const config = require('../config');

class DomInspector {
  constructor(htmlContent, cssContent, jsContent) {
    this.html = htmlContent !== undefined ? htmlContent : fs.readFileSync(config.INDEX_HTML, 'utf8');
    this.css = cssContent !== undefined ? cssContent : fs.readFileSync(config.LAYOUT_CSS, 'utf8');
    this.js = jsContent !== undefined ? jsContent : fs.readFileSync(config.APP_JS, 'utf8');
  }

  // --- Static Analysis & String Checks ---
  hasString(content, searchStr, caseInsensitive = true) {
    if (caseInsensitive) {
      return content.toLowerCase().includes(searchStr.toLowerCase());
    }
    return content.includes(searchStr);
  }

  findForbiddenStrings(content, forbiddenList = config.FORBIDDEN_LAKE_STRINGS) {
    const found = [];
    const lower = content.toLowerCase();
    for (const term of forbiddenList) {
      if (lower.includes(term.toLowerCase())) {
        found.push(term);
      }
    }
    return found;
  }

  // --- HTML Elements & Navigation Inspection ---
  hasElementWithId(id) {
    const regex = new RegExp(`id=["']${id}["']`, 'i');
    return regex.test(this.html);
  }

  hasElementWithClass(className) {
    const regex = new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, 'i');
    return regex.test(this.html);
  }

  getNavLinkHrefs() {
    const matches = [];
    const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(this.html)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  // --- Slide Panels Inspection ---
  getSlidePanels() {
    const panels = [];
    // Check panel id or slide classes
    const ids = ['panel-overview', 'panel-endpoints', 'panel-alerts', 'panel-response'];
    for (const id of ids) {
      if (this.hasElementWithId(id)) {
        panels.push(id);
      }
    }
    return panels;
  }

  hasSlideNavigationControls() {
    return {
      hasPrevButton: this.hasElementWithId('btn-slide-prev'),
      hasNextButton: this.hasElementWithId('btn-slide-next'),
    };
  }

  // --- Response Table Column Analysis ---
  getResponseTableHeaders() {
    // Extracts headers within the response actions table
    const tableMatch = /<table[^>]*id=["']response-table["'][^>]*>([\s\S]*?)<\/table>/i.exec(this.html);
    if (!tableMatch) return [];
    const theadMatch = /<thead[^>]*>([\s\S]*?)<\/thead>/i.exec(tableMatch[1]);
    if (!theadMatch) return [];
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    const headers = [];
    let match;
    while ((match = thRegex.exec(theadMatch[1])) !== null) {
      headers.push(match[1].replace(/<[^>]+>/g, '').trim());
    }
    return headers;
  }

  // --- CSS Transition & Reduced Motion Inspection ---
  hasReducedMotionQuery() {
    return /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(this.css);
  }

  getReducedMotionRules() {
    const match = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\}/i.exec(this.css);
    return match ? match[1] : null;
  }

  getTransitionDurationMs() {
    // Look for transition or transition-duration in slide / panel rules
    const matches = [];
    const regex = /(?:transition(?:-duration)?)\s*:\s*([^;]+);/gi;
    let match;
    while ((match = regex.exec(this.css)) !== null) {
      const val = match[1].trim();
      const msMatch = /(\d+(?:\.\d+)?)\s*ms/.exec(val);
      const sMatch = /(\d+(?:\.\d+)?)\s*s/.exec(val);
      if (msMatch) {
        matches.push(parseFloat(msMatch[1]));
      } else if (sMatch) {
        matches.push(parseFloat(sMatch[1]) * 1000);
      }
    }
    return matches;
  }
}

module.exports = {
  DomInspector,
};
