#!/usr/bin/env node
/**
 * contrast-audit.cjs — measure a rendered page against WCAG AA in headless Chromium.
 *
 * Usage: node contrast-audit.cjs <url-or-file> [--width 1400] [--scheme light|dark]
 *        [--header "Authorization: Bearer …"]
 *
 * A dark palette is a separate set of colour pairs: a light-only run says nothing
 * about it. Run both schemes on any page that ships one.
 * Needs playwright-core (any local install: set PLAYWRIGHT_CORE to its directory, or let
 * `require('playwright-core')` resolve it).
 *
 * Reports, as JSON: every text element below the AA ratio for its size (4.5:1, or 3:1
 * for ≥24 px / ≥18.66 px bold) with foreground, effective background and the measured
 * ratio; whether a skip link, a labelled <nav>, <main> and table captions exist; the
 * smallest rendered font size; SVGs inside text badges without aria-hidden. Hidden
 * elements are skipped. Exits non-zero on a contrast failure OR on a stylesheet/script
 * the page failed to load: an unstyled page has no contrast failures and would otherwise
 * pass for the wrong reason. Other failed requests (a template's placeholder images) are
 * listed under failedRequests without failing the run.
 *
 * Scope: text contrast (SC 1.4.3). It does NOT evaluate SC 1.4.11 non-text contrast —
 * control boundaries, focus rings, icons — so a green run is not a full AA verdict.
 *
 * `stateFailures` repeats the measurement with :hover and :focus-visible forced on every
 * interactive element (CDP CSS.forcePseudoState), because a hover colour is invisible to a
 * static read of the page and is where a generic `a:hover` quietly repaints a button label.
 * Transitions are disabled first: with `transition: color .2s`, getComputedStyle returns the
 * value from BEFORE the change and every such probe reports "nothing changed".
 *
 * Elements inside a [data-contrast-demo] subtree are skipped and counted in
 * demoExemptElements: a style guide has to be able to SHOW a failing pair. Use it only
 * for specimens the surrounding copy names as such, never to silence page chrome. The brand fact this exists for: white on #2F99A4 is 3.38:1 —
 * fine for large text and UI shapes, a fail for 14 px labels; use #15585E for those.
 *
 * `apcaWarnings` additionally reports each element whose APCA lightness contrast (Lc)
 * falls short of the value APCA's own font table asks for at that size and weight.
 * APCA is a readability check, not a conformance one: it is advisory here, it never
 * affects the exit code, and an APCA pass never waives a WCAG failure. WCAG 2.2 AA is
 * the gate — see the typo3-a11y skill for the policy. Algorithm and constants are
 * APCA-W3 0.1.9 (github.com/Myndex/apca-w3, W3 licence); note it uses the SAME sRGB
 * coefficients as WCAG (0.2126 / 0.7152 / 0.0722) and differs in the transfer curve,
 * polarity handling and the font-size/weight input, not in the coefficients.
 */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
// CLI arguments are only parsed when this file IS the entry point; required as a
// module (the error-path tests) it exposes its internals instead and parses nothing.
const CLI = require.main === module;
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const target = args.find((a) => !a.startsWith('--'));
const width = Number.parseInt(opt('--width', '1400'), 10);
const header = opt('--header', '');
const scheme = opt('--scheme', 'light');
if (CLI && !target) { console.error('usage: contrast-audit.cjs <url-or-file> [--width N] [--scheme light|dark] [--header "Name: value"]'); process.exit(2); }
if (CLI && !['light', 'dark'].includes(scheme)) { console.error(`--scheme must be light or dark, got ${scheme}`); process.exit(2); }
const url = target ? (/^https?:/.test(target) ? target : 'file://' + path.resolve(target)) : '';
// Measures :hover and :focus-visible on every interactive element, one element at a
// time. Forcing the whole set at once is a state no user can reach — every control
// hovered simultaneously — and an ancestor, sibling or :has() selector then resolves
// against that fiction.
const INTERACTIVE = 'a, button, input, textarea, select, summary, [tabindex]';
// A node can legitimately disappear between the query and the force. Anything else is
// a real failure and must not be swallowed: an element silently dropped here is an
// element whose hover colour nobody measured, in a run that still exits 0.
const isDetached = (e) => /Could not find node|No node (found )?with given id|Node with given id does not belong/i.test(String(e?.message));

async function measureOneNode(cdp, nodeId, state) {
  const { object } = await cdp.send('DOM.resolveNode', { nodeId });
  // No throw from a finally anywhere here: it would replace the measurement error
  // with whatever the cleanup said. Both are captured and reported together.
  let value;
  let measureError;
  try {
    const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId, returnByValue: true,
      functionDeclaration: 'function (state) { return window.__measureOne(this, state); }',
      arguments: [{ value: state }],
    });
    // callFunctionOn reports a thrown measurement through exceptionDetails and still
    // resolves; reading only result.value would drop the element quietly.
    if (exceptionDetails) throw new Error(`measurement threw: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
    value = result.value;
  } catch (e) {
    measureError = e;
  }
  // Releasing a handle whose node is already gone is expected; anything else is a
  // protocol failure and is reported rather than swallowed.
  let releaseError;
  await cdp.send('Runtime.releaseObject', { objectId: object.objectId })
    .catch((e) => { if (!isDetached(e)) releaseError = e; });
  if (measureError && releaseError) {
    // A detached node is normal and the caller swallows it — but it must not carry a
    // real release failure out with it, which is what appending would do: the outer
    // catch matches on the message, sees "detached", and drops both.
    if (isDetached(measureError)) throw releaseError;
    measureError.message += ` (release also failed: ${releaseError.message})`;
    throw measureError;
  }
  if (measureError) throw measureError;
  if (releaseError) throw releaseError;
  return value;
}

async function measureInteractiveStates(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('Runtime.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: INTERACTIVE });
  const failures = [];
  const seen = new Set();
  // Errors are collected, never thrown from a finally — a throw there replaces the
  // exception already on its way out, which would be the measurement failure this
  // whole pass exists to surface. Everything collected is reported together at the
  // end, so a cleanup problem cannot hide a measurement problem or vice versa.
  const errors = [];
  const reset = async (nodeId) => {
    try { await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }); }
    catch (e) { if (!isDetached(e)) errors.push(e); }
  };
  let aborted = false;
  for (const state of ['hover', 'focus-visible']) {
    if (aborted) break;
    for (const nodeId of nodeIds) {
      let forced = false;
      try {
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] });
        forced = true;
        const f = await measureOneNode(cdp, nodeId, state);
        if (!f) continue;
        const key = `${state}|${f.element}|${f.fg}|${f.bg}`;
        if (seen.has(key)) continue;
        seen.add(key);
        failures.push(f);
      } catch (e) {
        if (isDetached(e)) continue;
        // Stop measuring, but let this element's reset run and keep whatever the
        // cleanup of the elements before it reported.
        errors.push(e);
        aborted = true;
      } finally {
        if (forced) await reset(nodeId);
      }
      if (aborted) break;
    }
  }
  if (errors.length) {
    const [first, ...rest] = errors;
    if (rest.length) first.message += ` (+${rest.length} more: ${rest.map((e) => e.message).join('; ')})`;
    throw first;
  }
  return failures;
}

// Exported when required as a module so the error paths can be tested against a
// stubbed CDP session; running the file as a CLI is unaffected.
if (!CLI) { module.exports = { measureOneNode, measureInteractiveStates, isDetached }; }

(async () => {
  if (!CLI) return;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: true, colorScheme: scheme,
    extraHTTPHeaders: header ? { [header.split(':')[0].trim()]: header.split(':').slice(1).join(':').trim() } : {} });
  const page = await ctx.newPage();
  // A page whose stylesheet 404s renders unstyled and reports zero contrast failures —
  // it passes for the wrong reason. Collect every failed subresource and fail on it.
  // Only stylesheets and scripts gate the exit code: a missing image leaves the measured
  // colours intact, a missing stylesheet removes all of them. Templates legitimately point
  // at placeholder images, so those are reported and not failed on.
  const badRequests = [];
  const gates = (t) => t === 'stylesheet' || t === 'script';
  page.on('requestfailed', (r) => badRequests.push({ what: r.failure()?.errorText || 'failed', url: r.url(), type: r.resourceType(), gating: gates(r.resourceType()) }));
  page.on('response', (r) => { if (r.status() >= 400) badRequests.push({ what: `HTTP ${r.status()}`, url: r.url(), type: r.request().resourceType(), gating: gates(r.request().resourceType()) }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Kill transitions before measuring anything: see the note on stateFailures above.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  const result = await page.evaluate(() => {
    const parse = (c) => { const m = c.match(/\d+(\.\d+)?/g); return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 } : null; };
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    // Composite the translucent layers instead of taking the first one at face value:
    // rgba(255,255,255,.18) over a teal hero is NOT white, and reading it as white both
    // invents failures and hides them.
    const bgOf = (el) => {
      const stack = [];
      while (el) { const c = parse(getComputedStyle(el).backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
        el = el.parentElement; }
      let out = { r: 255, g: 255, b: 255 };
      for (let i = stack.length - 1; i >= 0; i--) { const c = stack[i];
        out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) }; }
      return { r: Math.round(out.r), g: Math.round(out.g), b: Math.round(out.b), a: 1 };
    };
    const ratio = (f, b) => { const l1 = lum(f), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

    // --- APCA-W3 0.1.9, verbatim constants and steps (W3 licence) -------------
    const SA98G = { mainTRC: 2.4, sRco: 0.2126729, sGco: 0.7151522, sBco: 0.0721750,
      normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
      blkThrs: 0.022, blkClmp: 1.414, scaleBoW: 1.14, scaleWoB: 1.14,
      loBoWoffset: 0.027, loWoBoffset: 0.027, deltaYmin: 0.0005, loClip: 0.1 };
    const apcaY = (c) => { const e = (v) => Math.pow(v / 255, SA98G.mainTRC);
      return SA98G.sRco * e(c.r) + SA98G.sGco * e(c.g) + SA98G.sBco * e(c.b); };
    const apcaLc = (fg, bg) => {
      let t = apcaY(fg), b = apcaY(bg);
      t = t > SA98G.blkThrs ? t : t + Math.pow(SA98G.blkThrs - t, SA98G.blkClmp);
      b = b > SA98G.blkThrs ? b : b + Math.pow(SA98G.blkThrs - b, SA98G.blkClmp);
      if (Math.abs(b - t) < SA98G.deltaYmin) return 0;
      let sapc, out;
      if (b > t) { sapc = (Math.pow(b, SA98G.normBG) - Math.pow(t, SA98G.normTXT)) * SA98G.scaleBoW;
        out = sapc < SA98G.loClip ? 0 : sapc - SA98G.loBoWoffset;
      } else { sapc = (Math.pow(b, SA98G.revBG) - Math.pow(t, SA98G.revTXT)) * SA98G.scaleWoB;
        out = sapc > -SA98G.loClip ? 0 : sapc + SA98G.loWoBoffset; }
      return out * 100;
    };
    // fontMatrixAscend from apca-w3: row = Lc, columns = weight 100…900, cell = the
    // smallest font size in px that Lc permits. 999/777 mean "no size is readable".
    const FONT_MATRIX = [
      [15,777,777,777,777,777,777,777,777,777],[20,777,777,777,777,777,777,777,777,777],
      [25,777,777,777,120,120,108,96,96,96],[30,777,777,120,108,108,96,72,72,72],
      [35,777,120,108,96,72,60,48,48,48],[40,120,108,96,60,48,42,32,32,32],
      [45,108,96,72,42,32,28,24,24,24],[50,96,72,60,32,28,24,21,21,21],
      [55,80,60,48,28,24,21,18,18,18],[60,72,48,42,24,21,18,16,16,18],
      [65,68,46,32,21.75,19,17,15,16,18],[70,64,44,28,19.5,18,16,14.5,16,18],
      [75,60,42,24,18,16,15,14,16,18],[80,56,38.25,23,17.25,15.81,14.81,14,16,18],
      [85,52,34.5,22,16.5,15.625,14.625,14,16,18],[90,48,32,21,16,15.5,14.5,14,16,18],
      [95,45,28,19.5,15.5,15,14,13.5,16,18],[100,42,26.5,18.5,15,14.5,13.5,13,16,18],
      [105,39,25,18,14.5,14,13,12,16,18],[110,36,24,18,14,13,12,11,16,18],
      [115,34.5,22.5,17.25,12.5,11.875,11.25,10.625,14.5,16.5],
      [120,33,21,16.5,11,10.75,10.5,10.25,13,15],[125,32,20,16,10,10,10,10,12,14],
    ];
    // Smallest Lc that permits this size at this weight; null when the table has none.
    // Interpolated between the two bracketing rows, as apca-w3's own fontLookupAPCA
    // does — a plain row lookup rounds up to the next 5-Lc step and would warn about
    // e.g. 30px/400 at Lc 55 where the interpolated requirement is 52.5. Never below
    // APCA's own text floor: fontLookupAPCA marks anything under Lc 29.5 as non-text
    // at every size, so the Lc 25 row must not license 120px body copy at Lc 27.
    const APCA_TEXT_FLOOR = 29.5;
    const apcaRequired = (size, weight) => {
      const col = Math.min(9, Math.max(1, Math.round(weight / 100)));
      const usable = (v) => v !== 999 && v !== 777;
      for (let i = 0; i < FONT_MATRIX.length; i++) {
        const min = FONT_MATRIX[i][col];
        if (!usable(min) || size < min) continue;
        const prev = i > 0 ? FONT_MATRIX[i - 1] : null;
        if (!prev || !usable(prev[col]) || prev[col] <= min) return Math.max(FONT_MATRIX[i][0], APCA_TEXT_FLOOR);
        const span = prev[col] - min;
        const need = FONT_MATRIX[i][0] - ((size - min) / span) * (FONT_MATRIX[i][0] - prev[0]);
        return Math.max(need, APCA_TEXT_FLOOR);
      }
      return null;
    };
    const seen = new Map();
    const apcaSeen = new Map();
    let smallest = Infinity;
    let exempt = 0;
    // <title>/<desc> inside an SVG are accessible names, never painted; script/style/
    // template hold source text. None of them have a rendered contrast.
    const describe = (el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().replaceAll(/\s+/g, '.') : '');
    const NOT_PAINTED = new Set(['TITLE', 'DESC', 'SCRIPT', 'STYLE', 'TEMPLATE', 'METADATA', 'NOSCRIPT']);
    for (const el of document.querySelectorAll('body *')) {
      if (NOT_PAINTED.has(el.tagName.toUpperCase())) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      // A style guide legitimately shows failing pairs as specimens. They must be declared
      // with data-contrast-demo, and the count is reported so the exemption is visible.
      if (el.closest('[data-contrast-demo]')) { exempt++; continue; }
      const size = Number.parseFloat(cs.fontSize); smallest = Math.min(smallest, size);
      const fg = parse(cs.color); const bg = bgOf(el); const r = ratio(fg, bg);
      const weight = Number.parseInt(cs.fontWeight, 10) || 400;
      const bold = weight >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const lc = apcaLc(fg, bg);
      const lcNeed = apcaRequired(size, weight);
      if (lcNeed !== null && Math.abs(lc) < lcNeed) {
        const akey = `apca|${el.tagName}.${el.className}|${cs.color}|${bg.r},${bg.g},${bg.b}|${size}`;
        if (!apcaSeen.has(akey)) apcaSeen.set(akey, { element: describe(el), text: el.textContent.trim().slice(0, 40), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, lc: +lc.toFixed(1), lcRequired: +lcNeed.toFixed(1), fontSize: size, fontWeight: cs.fontWeight });
      }
      if (r < need) {
        const key = `${el.tagName}.${el.className}|${cs.color}|${bg.r},${bg.g},${bg.b}`;
        if (!seen.has(key)) seen.set(key, { element: describe(el), text: el.textContent.trim().slice(0, 40), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +r.toFixed(2), required: need, fontSize: size });
      }
    }
    // Re-used by the interactive-state pass, which runs after this evaluate returns.
    // Measures ONE element — the one currently forced into `state`. The caller hands
    // it over by object reference (CDP DOM.resolveNode + Runtime.callFunctionOn), so
    // nothing in the page has to be marked or mutated to find it again.
    window.__measureOne = (el, state) => {
      if (!el || el.closest('[data-contrast-demo]')) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) return null;
      // Unlike the main pass, a wrapped label counts here: in <a><span>Read more</span></a>
      // the colour that :hover changes sits on the <a>, and requiring a direct text node
      // would skip exactly those controls.
      if (!el.textContent.trim()) return null;
      const fg = parse(cs.color); const bg = bgOf(el); const r = ratio(fg, bg);
      const size = Number.parseFloat(cs.fontSize);
      const bold = (Number.parseInt(cs.fontWeight, 10) || 400) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      if (r >= need) return null;
      return { state, element: describe(el), text: el.textContent.trim().slice(0, 40), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +r.toFixed(2), required: need, fontSize: size };
    };

    return {
      contrastFailures: [...seen.values()],
      // Advisory only: readability, not conformance. Never gates the exit code.
      apcaWarnings: [...apcaSeen.values()],
      demoExemptElements: exempt,
      skipLink: !!document.querySelector('a[href^="#"].skip, a[href="#main"], a[href="#content"], a[href="#inhalt"]'),
      mainLandmark: !!document.querySelector('main'),
      navLabelled: [...document.querySelectorAll('nav')].every((n) => n.getAttribute('aria-label') || n.getAttribute('aria-labelledby')),
      tablesWithCaption: `${document.querySelectorAll('table caption').length} of ${document.querySelectorAll('table').length}`,
      smallestFontPx: +smallest.toFixed(1),
      decorativeSvgWithoutAriaHidden: [...document.querySelectorAll('a svg, button svg, .badge svg')].filter((s) => s.getAttribute('aria-hidden') !== 'true' && !s.getAttribute('role')).length,
      darkScheme: [...document.styleSheets].some((ss) => { try { return [...ss.cssRules].some((r) => /prefers-color-scheme|data-theme/.test(r.cssText)); } catch (e) { return false; } }),
      // Stylesheets the page linked but the browser could not read (cross-origin, or not
      // served). Rules inside them are invisible to `darkScheme`, so report the count
      // rather than letting it read as "no dark theme".
      unreadableStylesheets: [...document.styleSheets].filter((ss) => { try { return !ss.cssRules; } catch (e) { return true; } }).length,
    };
  });
  result.stateFailures = await measureInteractiveStates(page);

  result.scheme = scheme;
  result.failedRequests = badRequests;
  const blocking = badRequests.filter((r) => r.gating);
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
  process.exit(result.contrastFailures.length || result.stateFailures.length || blocking.length ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
