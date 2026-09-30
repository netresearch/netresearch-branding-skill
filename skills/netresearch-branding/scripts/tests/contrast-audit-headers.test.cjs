#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Netresearch DTT GmbH
/**
 * Scope of contrast-audit.cjs's --header value, against two local servers: the target
 * and a second origin (another port, so another origin) that the target page loads
 * resources from, directly and through a redirect.
 *
 * The property under test: the header reaches the target's origin and nothing else,
 * including a redirect hop from the target to the second origin. The second origin
 * must receive its requests (the control that they happened) without the header.
 *
 * Needs playwright-core (PLAYWRIGHT_CORE or require resolution, as the audit does).
 */
const assert = require('assert');
const http = require('http');
const { after, before, test } = require('node:test');
const { audit } = require('./spawn-audit.cjs');

const TOKEN = 'Bearer dummy-token-for-header-scope-test';

// Every request each server receives, with its Authorization header.
const received = { target: [], other: [] };
const record = (name) => (req) => received[name].push({ url: req.url, authorization: req.headers.authorization });
const css = (res) => { res.writeHead(200, { 'content-type': 'text/css' }); res.end('p{color:#000}'); };

let targetBase; let otherBase;
const other = http.createServer((req, res) => { record('other')(req); css(res); });
const target = http.createServer((req, res) => {
  record('target')(req);
  if (req.url === '/own.css') { css(res); return; }
  // A same-origin URL that redirects to the second origin: the hop must lose the header.
  if (req.url === '/redirect.css') { res.writeHead(302, { location: `${otherBase}/via-redirect.css` }); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><html lang="en"><title>t</title>
<link rel="stylesheet" href="/own.css">
<link rel="stylesheet" href="${otherBase}/direct.css">
<link rel="stylesheet" href="/redirect.css">
<main><p>Text</p></main></html>`);
});

before(async () => {
  await new Promise((resolve) => other.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
  otherBase = `http://127.0.0.1:${other.address().port}`;
  targetBase = `http://127.0.0.1:${target.address().port}`;
});
after(() => {
  target.close(); other.close();
});

test('--header reaches the target origin and no other, not even through a redirect', async () => {
  received.target.length = 0; received.other.length = 0;
  const r = await audit(`${targetBase}/`, '--header', `Authorization: ${TOKEN}`);
  const leaked = received.other.filter((q) => q.authorization);
  assert.deepStrictEqual(leaked, [], `the second origin received the header: ${JSON.stringify(leaked)}`);
  const otherUrls = [...new Set(received.other.map((q) => q.url))].sort();
  assert.deepStrictEqual(otherUrls, ['/direct.css', '/via-redirect.css'],
    `control: the second origin must have been asked for both stylesheets, got ${JSON.stringify(received.other)}`);
  for (const u of ['/', '/own.css', '/redirect.css']) {
    const q = received.target.find((x) => x.url === u);
    assert.ok(q, `the target must have received ${u}`);
    assert.strictEqual(q.authorization, TOKEN, `the target must receive the header on ${u}`);
  }
  assert.strictEqual(r.code, 0, `the audit must pass, got exit ${r.code}: ${r.stderr.trim()}`);
});

test('--header with a non-loopback http:// target is refused before any connection', async () => {
  const r = await audit('http://example.invalid/', '--header', `Authorization: ${TOKEN}`);
  assert.strictEqual(r.code, 2, `expected the usage exit code 2, got ${r.code}`);
  assert.match(r.stderr, /--header needs an https:\/\/ target/);
});
