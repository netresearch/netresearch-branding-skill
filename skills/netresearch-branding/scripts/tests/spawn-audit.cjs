// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Netresearch DTT GmbH
/**
 * Runs contrast-audit.cjs as a child process with the given arguments and resolves
 * with its exit code and output. Shared by the tests that drive the audit end to end.
 */
const { spawn } = require('child_process');
const path = require('path');

const AUDIT = path.join(__dirname, '..', 'contrast-audit.cjs');

function audit(...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [AUDIT, ...args], { env: process.env });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

module.exports = { audit };
