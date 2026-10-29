const fs = require('fs');

const js = fs.readFileSync('console/static/app.js', 'utf8');
const html = fs.readFileSync('console/static/index.html', 'utf8');
const css = fs.readFileSync('console/static/css/layout.css', 'utf8');

// Extract $(...)
const dollarRegex = /\$\((?:\"([^\"]+)\"|'([^']+)')\)/g;
const allIds = new Set();
let match;
while ((match = dollarRegex.exec(js)) !== null) {
  allIds.add(match[1] || match[2]);
}

// Extract getElementById(...)
const getRegex = /getElementById\((?:\"([^\"]+)\"|'([^']+)')\)/g;
while ((match = getRegex.exec(js)) !== null) {
  allIds.add(match[1] || match[2]);
}

console.log('Total unique IDs referenced in app.js:', allIds.size);
const missingInHtml = [];
for (const id of Array.from(allIds).sort()) {
  const pattern1 = `id="${id}"`;
  const pattern2 = `id='${id}'`;
  if (!html.includes(pattern1) && !html.includes(pattern2)) {
    missingInHtml.push(id);
  }
}
console.log('IDs referenced in app.js but not directly in index.html:', missingInHtml);

// Extract CSS #id selectors
const cssIdRegex = /#([a-zA-Z0-9_\-]+)/g;
const cssIds = new Set();
while ((match = cssIdRegex.exec(css)) !== null) {
  // Filter out hex colors like #fff, #111B25, #000, etc.
  const val = match[1];
  if (/^[0-9a-fA-F]{3,8}$/.test(val)) continue;
  cssIds.add(val);
}
console.log('Total CSS #id selectors (non-color):', cssIds.size);

const missingCssIds = [];
for (const cid of Array.from(cssIds).sort()) {
  const inHtml = html.includes(`id="${cid}"`) || html.includes(`id='${cid}'`);
  const inJs = allIds.has(cid) || js.includes(`"${cid}"`) || js.includes(`'${cid}'`) || js.includes(`\`${cid}\``);
  if (!inHtml && !inJs) {
    missingCssIds.push(cid);
  }
}
console.log('CSS #id selectors not found in HTML or JS:', missingCssIds);
