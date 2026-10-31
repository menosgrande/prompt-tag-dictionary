import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("dictionary header and rows share one horizontal scroll viewport", () => {
  const shellStart = html.indexOf('class="table-scroll-shell"');
  const shellEnd = html.indexOf('id="loading-state"', shellStart);
  assert.ok(shellStart >= 0 && shellEnd > shellStart, "table scroll shell exists");
  const shell = html.slice(shellStart, shellEnd);
  assert.match(shell, /class="table-head"/);
  assert.match(shell, /id="tag-results"/);
  assert.equal((shell.match(/class="table-head-cell"/g) || []).length, 9);
  assert.equal((shell.match(/class="column-resize"/g) || []).length, 9);
});

test("header and data rows use the same resizable column template", () => {
  assert.match(css, /\.table-head,\.tag-row\s*\{[^}]*grid-template-columns:var\(--tag-list-columns/);
  assert.match(css, /\.table-scroll-shell\s*\{[^}]*overflow-x:auto/s);
  assert.match(css, /\.table-scroll-shell \.tag-results\s*\{[^}]*overflow-y:auto/s);
});

test("rerendering the tag list preserves its vertical scroll position", () => {
  assert.match(app, /const previousScrollTop = root\.scrollTop;/);
  assert.match(app, /root\.scrollTop = previousScrollTop;/);
  assert.doesNotMatch(app, /head\.style\.transform\s*=\s*"translateX/);
  assert.match(app, /function resetResultsViewport\(\)/);
  assert.match(app, /resetResultsViewport\(\); state\.query = e\.target\.value/);
});
