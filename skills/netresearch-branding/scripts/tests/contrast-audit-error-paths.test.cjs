#!/usr/bin/env node
/**
 * Error paths of contrast-audit.cjs's state pass, against a stubbed CDP session.
 *
 * These are the paths where a bug is invisible: every one of them ends in a run that
 * exits 0 with an element quietly unmeasured. The audit exists to stop exactly that,
 * so its own failure handling gets the same treatment.
 */
const assert = require('assert');
const { measureOneNode, isDetached } = require('../contrast-audit.cjs');

const DETACHED = 'Could not find node with given id';

// A CDP double: `fail` decides which command rejects, `threw` simulates a measurement
// that raised inside the page (callFunctionOn reports that via exceptionDetails).
function stubCdp({ failRelease, failCall, threw } = {}) {
  const calls = [];
  return {
    calls,
    async send(method, params) {
      calls.push(method);
      if (method === 'DOM.resolveNode') return { object: { objectId: 'obj-1' } };
      if (method === 'Runtime.callFunctionOn') {
        if (failCall) throw new Error(failCall);
        if (threw) return { result: {}, exceptionDetails: { exception: { description: threw } } };
        return { result: { value: { element: 'a.btn', fg: 'rgb(0,0,0)', bg: 'rgb(0,0,0)', ratio: 1 } } };
      }
      if (method === 'Runtime.releaseObject') { if (failRelease) throw new Error(failRelease); return {}; }
      return {};
    },
  };
}

const tests = [
  ['a clean measurement returns its value and releases the handle', async () => {
    const cdp = stubCdp();
    const r = await measureOneNode(cdp, 1, 'hover');
    assert.strictEqual(r.element, 'a.btn');
    assert.ok(cdp.calls.includes('Runtime.releaseObject'), 'handle must be released');
  }],

  ['a measurement that throws inside the page surfaces, it is not returned as empty', async () => {
    const cdp = stubCdp({ threw: 'Error: boom' });
    await assert.rejects(() => measureOneNode(cdp, 1, 'hover'), /measurement threw: Error: boom/);
    assert.ok(cdp.calls.includes('Runtime.releaseObject'), 'handle must be released even then');
  }],

  ['a failed release surfaces on its own', async () => {
    const cdp = stubCdp({ failRelease: 'protocol exploded' });
    await assert.rejects(() => measureOneNode(cdp, 1, 'hover'), /protocol exploded/);
  }],

  ['both failing reports the measurement error WITH the release failure appended', async () => {
    const cdp = stubCdp({ threw: 'Error: boom', failRelease: 'protocol exploded' });
    await assert.rejects(() => measureOneNode(cdp, 1, 'hover'),
      (e) => /measurement threw: Error: boom/.test(e.message) && /release also failed: protocol exploded/.test(e.message));
  }],

  ['a DETACHED measurement must not carry a real release failure out with it', async () => {
    // The caller swallows detached errors by matching the message. Appending the
    // release failure to a detached error would make the caller drop both.
    const cdp = stubCdp({ failCall: DETACHED, failRelease: 'protocol exploded' });
    await assert.rejects(() => measureOneNode(cdp, 1, 'hover'), (e) => {
      assert.ok(!isDetached(e), 'the thrown error must NOT look detached to the caller');
      return /protocol exploded/.test(e.message);
    });
  }],

  ['a detached node with a clean release stays detached, so the caller can skip it', async () => {
    const cdp = stubCdp({ failCall: DETACHED });
    await assert.rejects(() => measureOneNode(cdp, 1, 'hover'), (e) => isDetached(e));
  }],
];

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`ok   ${name}`); }
    catch (e) { failed++; console.error(`FAIL ${name}\n     ${e.message}`); }
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
