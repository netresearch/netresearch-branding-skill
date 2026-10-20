#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Netresearch DTT GmbH
/**
 * What contrast-audit.cjs detects on a file:// page whose styles live in an external
 * stylesheet — the case where Chromium refuses `cssRules` to scripts.
 *
 * - darkScheme / darkSchemeBy come from computed colours, so a dark palette in such a
 *   stylesheet is found, for prefers-color-scheme and for data-theme alike.
 * - focusRingFailures: an author outline or box-shadow ring below 3:1 fails the run; the
 *   browser's own `outline: auto` ring is counted and not judged.
 * - controlBoundaryFailures: an enabled input whose border and fill are below 3:1
 *   against the surface fails the run; a disabled one is exempt.
 *
 * Needs playwright-core (PLAYWRIGHT_CORE or require resolution, as the audit does).
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { after, test } = require('node:test');
const { audit } = require('./spawn-audit.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrast-audit-detection-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

// Writes `name`.html linking `name`.css and returns the page path.
function fixture(name, css, body) {
  fs.writeFileSync(path.join(dir, `${name}.css`), `body{background:#fff;color:#000}${css}`);
  fs.writeFileSync(path.join(dir, `${name}.html`), `<!doctype html><html lang="en"><title>${name}</title>
<link rel="stylesheet" href="${name}.css"><main>${body}</main></html>`);
  return path.join(dir, `${name}.html`);
}

async function run(page) {
  const r = await audit(page);
  let json;
  try { json = JSON.parse(r.stdout); } catch (e) { assert.fail(`no JSON from the audit (exit ${r.code}): ${r.stderr.trim()}`); }
  return { code: r.code, json };
}

test('a prefers-color-scheme palette in an external stylesheet is detected', async () => {
  const { json } = await run(fixture('media', '@media (prefers-color-scheme: dark){body{background:#111;color:#eee}}', '<p>Text</p>'));
  assert.ok(json.unreadableStylesheets >= 1, `control: the stylesheet must be unreadable to scripts, got ${json.unreadableStylesheets}`);
  assert.strictEqual(json.darkScheme, true);
  assert.deepStrictEqual(json.darkSchemeBy, ['prefers-color-scheme']);
});

test('a data-theme palette in an external stylesheet is detected', async () => {
  const { json } = await run(fixture('theme', '[data-theme="dark"] body{background:#111;color:#eee}', '<p>Text</p>'));
  assert.deepStrictEqual(json.darkSchemeBy, ['data-theme']);
});

test('a page without a dark palette reports none', async () => {
  const { code, json } = await run(fixture('plain', '', '<p>Text</p>'));
  assert.strictEqual(json.darkScheme, false);
  assert.deepStrictEqual(json.darkSchemeBy, []);
  assert.strictEqual(code, 0);
});

test('an author focus ring or a control boundary below 3:1 fails the run', async () => {
  const { code, json } = await run(fixture('weak',
    'a:focus-visible{outline:2px solid #eee;outline-offset:2px}'
    + 'button{color:#000;background:#fff;border:1px solid #000}button:focus-visible{outline:none;box-shadow:0 0 0 3px #eee}'
    + 'input{border:1px solid #ddd;background:#fff}',
    '<p><a href="#x">Link</a></p><button type="button">Go</button><label>Name <input></label>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => `${f.element} ${f.indicator}`).sort(), ['a outline', 'button box-shadow']);
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element), ['input']);
  assert.strictEqual(code, 1, 'non-text failures must fail the run');
});

test('rings and boundaries at 3:1 or more pass; disabled controls and the browser ring are not judged', async () => {
  const { code, json } = await run(fixture('strong',
    'a:focus-visible{outline:2px solid #585961;outline-offset:2px}'
    + 'button{color:#000;background:#fff;border:1px solid #000}button:focus-visible{outline:none;box-shadow:0 0 0 3px #585961}'
    + 'input{border:1px solid #767676;background:#fff}input:disabled{border-color:#eee}',
    '<p><a href="#x">Link</a></p><button type="button">Go</button><label>Name <input></label>'
    + '<label>Off <input disabled></label><p><span tabindex="0">Plain focus</span></p>'));
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.ok(json.focusUserAgentRing >= 1, `the span keeps the browser ring and must be counted, got ${json.focusUserAgentRing}`);
  assert.strictEqual(code, 0, `expected a pass, got exit ${code}`);
});
