#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Netresearch DTT GmbH
/**
 * TLS verification of contrast-audit.cjs, against a local HTTPS server whose
 * certificate is self-signed and therefore untrusted.
 *
 * The property under test: an invalid certificate aborts the connection before any
 * HTTP request - and with it a --header credential - reaches the server, for the page
 * itself and for its subresources. The --insecure run is the positive control: it
 * proves the server is reachable and records requests, so "no request arrived" in the
 * other cases means the client refused, not that nothing was listening.
 *
 * Needs playwright-core (PLAYWRIGHT_CORE or require resolution, as the audit does)
 * and `openssl` on PATH to create the throwaway certificate.
 */
const assert = require('assert');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const AUDIT = path.join(__dirname, '..', 'contrast-audit.cjs');
const TOKEN = 'Bearer dummy-token-for-tls-test';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contrast-audit-tls-'));
const keyFile = path.join(tmp, 'key.pem');
const certFile = path.join(tmp, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile,
  '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });

// Every request the server receives, with its Authorization header.
const received = [];
const server = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (req, res) => {
  received.push({ url: req.url, authorization: req.headers.authorization });
  if (req.url.endsWith('.css')) { res.writeHead(200, { 'content-type': 'text/css' }); res.end('p{color:#000}'); return; }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><html lang="en"><title>t</title><main><p>Text</p></main></html>');
});

function audit(...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [AUDIT, ...args], { env: process.env });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

let base;
const tests = [
  ['an untrusted certificate aborts the page load before the --header credential is sent', async () => {
    received.length = 0;
    const r = await audit(`${base}/`, '--header', `Authorization: ${TOKEN}`);
    assert.ok(!received.some((q) => q.authorization === TOKEN), 'the Authorization header reached the server');
    assert.strictEqual(received.length, 0, `no request may reach the server, got ${received.length}`);
    assert.notStrictEqual(r.code, 0, `the run must fail, got exit ${r.code}`);
    assert.match(r.stderr, /ERR_CERT/, `the failure must be the certificate, got: ${r.stderr.trim()}`);
  }],

  ['an untrusted certificate on a subresource fails that request and the run', async () => {
    received.length = 0;
    const page = path.join(tmp, 'page.html');
    fs.writeFileSync(page, `<!doctype html><html lang="en"><title>t</title><link rel="stylesheet" href="${base}/x.css"><main><p>Text</p></main></html>`);
    const r = await audit(page);
    assert.strictEqual(received.length, 0, `no request may reach the server, got ${received.length}`);
    assert.strictEqual(r.code, 1, `a stylesheet that did not load must fail the run, got exit ${r.code}: ${r.stderr.trim()}`);
    const failed = JSON.parse(r.stdout).failedRequests;
    assert.ok(failed.some((f) => f.url === `${base}/x.css` && /ERR_CERT/.test(f.what) && f.gating),
      `the stylesheet must be reported as a gating certificate failure, got ${JSON.stringify(failed)}`);
  }],

  ['--insecure together with --header is refused before any connection', async () => {
    received.length = 0;
    const r = await audit(`${base}/`, '--insecure', '--header', `Authorization: ${TOKEN}`);
    assert.strictEqual(r.code, 2, `expected the usage exit code 2, got ${r.code}`);
    assert.match(r.stderr, /--insecure cannot be combined with --header/);
    assert.strictEqual(received.length, 0, `no request may reach the server, got ${received.length}`);
  }],

  ['control: --insecure alone reaches the same server, so the checks above can see a request', async () => {
    received.length = 0;
    const r = await audit(`${base}/`, '--insecure');
    assert.strictEqual(r.code, 0, `the page must load with --insecure, got exit ${r.code}: ${r.stderr.trim()}`);
    assert.ok(received.some((q) => q.url === '/'), `the server must have seen the page request, got ${JSON.stringify(received)}`);
  }],
];

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `https://127.0.0.1:${server.address().port}`;
  let failed = 0;
  try {
    for (const [name, fn] of tests) {
      try { await fn(); console.log(`ok   ${name}`); }
      catch (e) { failed++; console.error(`FAIL ${name}\n     ${e.message}`); }
    }
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
