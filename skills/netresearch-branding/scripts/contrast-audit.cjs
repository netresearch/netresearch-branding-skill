#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Netresearch DTT GmbH
/**
 * contrast-audit.cjs — measure a rendered page against WCAG AA in headless Chromium.
 *
 * Usage: node contrast-audit.cjs <url-or-file> [--width 1400] [--scheme light|dark]
 *        [--header "Authorization: Bearer …"] [--insecure]
 *
 * TLS certificates are verified for the page and every subresource: an invalid or
 * self-signed certificate aborts the connection before any request, and with it any
 * --header value, is sent. A failed page load exits 2; a failed stylesheet or script
 * exits 1 (see below). --insecure turns verification off for a local development server
 * with a self-signed certificate. It cannot be combined with --header: a credential is
 * never sent over a connection whose peer was not verified.
 *
 * The --header value is sent only to the target's own origin (scheme, host and port),
 * never to a stylesheet, font or image from another origin, and not across a redirect
 * to another origin: every request, and every redirect hop, is checked on its own. An
 * http:// target is refused with --header unless its host is localhost, 127.0.0.1 or
 * [::1], because the header would otherwise cross the network unencrypted.
 *
 * A dark palette is a separate set of colour pairs: a light-only run says nothing
 * about it. Run both schemes on any page that ships one.
 * Needs playwright-core (any local install: set PLAYWRIGHT_CORE to its directory, or let
 * `require('playwright-core')` resolve it). In this repository, `npm ci --ignore-scripts`
 * installs the version package-lock.json pins and `npx playwright-core install chromium`
 * its browser.
 *
 * Reports, as JSON: every text element below the AA ratio for its size (4.5:1, or 3:1
 * for ≥24 px / ≥18.66 px bold) with foreground, effective background and the measured
 * ratio; whether a skip link, a labelled <nav>, <main> and table captions exist; the
 * smallest rendered font size; SVGs inside text badges without aria-hidden. Hidden
 * elements (their own or an ancestor's display or visibility) are skipped; a submenu that
 * only a parent item's :hover reveals is therefore measured only through its focus state.
 * Measured although checkVisibility() calls them hidden: the options of a <select>, the
 * content of a closed <details> (also one nested in another closed one) and display:
 * contents (no box, but its text is painted; its own background is not painted and is
 * not composited). A single-line <select> is measured on the shown value in its own
 * colour.
 * Exits non-zero on a contrast failure (text or non-text) OR on a stylesheet/script
 * the page failed to load: an unstyled page has no contrast failures and would otherwise
 * pass for the wrong reason. Other failed requests (a template's placeholder images) are
 * listed under failedRequests without failing the run.
 *
 * Scope: text contrast (SC 1.4.3) and two parts of SC 1.4.11 non-text contrast, each at
 * 3:1 and each failing the run. `focusRingFailures`: what changes on each interactive
 * element between unfocused and forced :focus plus :focus-visible — its outline, each
 * box-shadow ring layer (a blurred one at the pixel next to the border), its border — each against
 * the colour next to it; the indicator passes when any changed part reaches 3:1, and a
 * shadow present in both states is not an indicator. `controlBoundaryFailures`: the
 * border (painted over the control's fill), a box-shadow ring (Tailwind's `ring-1
 * ring-inset`) or the fill of each input, select and textarea against the surface
 * around it. Both are composited as the page paints them, with the opacity of the
 * control and its ancestors.
 * Disabled controls (also in a disabled fieldset), controls in a hidden ancestor or a
 * closed dialog, controls at opacity 0 (their own or an ancestor's) at every position
 * the scroll pass reaches and 1px visually hidden form fields are skipped; the opacity-0
 * ones are counted in `transparentControlsSkipped`, with a note on stderr; one hidden by
 * display or visibility everywhere (a closed menu) is skipped like any hidden element and
 * not counted. A control hidden at the top (opacity 0, display or visibility) that was
 * visible further down is measured at that position, and so is a control that exists
 * only while the page is scrolled: its resting text, hover, focus and boundary. A
 * scroll-driven animation (animation-timeline) is left to show the state of each
 * position. Animations are settled again at each such position; a colour tween driven by
 * requestAnimationFrame (not a CSS or Web Animations API animation) is measured where it
 * stands. Not covered: text that is not a control and appears only on scroll (a banner),
 * the scrolled look of a control already visible at the top (a sticky header's scrolled
 * palette), a control with display: contents shown only on scroll, and a scrolling
 * container inside the page; the scroll pass covers the window's own scroll. Before
 * anything is measured, the pointer is moved outside the viewport. mouseleave and
 * pointerleave on the document, <html> and <body>, and mouseout and pointerout that
 * leave the window (also to a page's own listener or listener object on <html> or
 * <body>), are held back, and an onmouseout/onpointerout handler there is removed for
 * the rest of the run, so an exit-intent popup does not open, while an element's own
 * leave events still release its hover. A leave such a listener skipped is then handed
 * to that listener alone, with <body> as related target and the path and phase it had,
 * so a hover-out delegated from <html> or <body> still releases. Not covered: an
 * exit-intent capture listener on window or the document; an exit check that compares the
 * related target with <body>; a hover state on <html> or <body> itself that ends only when
 * the pointer leaves the page (the same check an exit-intent popup makes); a hover
 * delegated from the document for an element at (0, 0), where the pointer starts; a
 * hover-out that waits longer than 1 s in total, or that resumes in a later task (an
 * await on an animation frame, a fetch or an event) before it sets its timer, or whose
 * timer is set by a string interval (setInterval("code", ms)); and the order of leave listeners when an
 * element's own mouseleave replaces it. The page is scrolled through
 * once, instantly (content revealed on scroll, also content that hides again when
 * scrolled away), infinite animations are cancelled and finite ones finished,
 * unless finishing leaves the element less visible (a toast fading out), so a fade-in
 * counts at its final opacity. An animation started later by a forced :hover or :focus
 * is measured at its start. An <a> without href is measured hovered, never focused; a
 * tabindex="-1" element without a widget role (a skip-link target), inert content and a
 * tabindex="-1" element under aria-hidden are not judged as focus indicators; <area> is
 * not measured. A state failure names the control and, where it differs, the text
 * inside it that fails; a text that fails the same way at rest is reported only there.
 * An outline that only moves on focus counts as changed, except the moves Chromium's own
 * focus styles apply (1px on a link, 2px on a checkbox or radio). Elements whose focus
 * changes no outline, ring or border are counted in `focusWithoutRing`, and the
 * browser's own `outline: auto` ring, in the browser's focus-ring colour for the control's
 * used color-scheme, in `focusUserAgentRing`; neither is judged (an `auto` ring in an
 * author's colour is). A ring drawn on another element (a sibling label, a :focus-within
 * ancestor) is not seen, nor is the effect of `filter` or `mix-blend-mode` on a ring or a
 * boundary. Content inside an iframe is not measured.
 * Icons, charts and other graphics are not evaluated, so a green run is still not a
 * full AA verdict. rgb() and rgba() are read numerically; other notations (oklch(),
 * color()) go through a canvas. An element focused on load is blurred before any
 * measurement, and the focused state is always forced as :focus with :focus-visible.
 *
 * `darkScheme` / `darkSchemeBy` say whether the page switches its colours under the
 * other `prefers-color-scheme` or either `data-theme` value, measured from computed
 * colours, so a stylesheet the browser keeps unreadable cannot hide a dark palette.
 * `data-theme` counts when its "dark" and "light" values give different colours; the run
 * then sets it on <html> to its --scheme before measuring (`dataThemeSet`), so
 * `--scheme dark` measures that palette too. A page's own other value (a named theme such
 * as data-theme="corporate") is kept and reported in `dataThemeKept`. Only `data-theme`
 * on <html> is detected (not on <body>, not `data-bs-theme`).
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
const insecure = args.includes('--insecure');
if (CLI && !target) { console.error('usage: contrast-audit.cjs <url-or-file> [--width N] [--scheme light|dark] [--header "Name: value"] [--insecure]'); process.exit(2); }
if (CLI && !['light', 'dark'].includes(scheme)) { console.error(`--scheme must be light or dark, got ${scheme}`); process.exit(2); }
// Checked before the browser starts, so nothing has connected anywhere yet.
if (CLI && insecure && header) { console.error('--insecure cannot be combined with --header: the header would be sent to a server whose certificate was not verified'); process.exit(2); }
const url = target ? (/^https?:/.test(target) ? target : 'file://' + path.resolve(target)) : '';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
if (CLI && header && url.startsWith('http:') && !LOOPBACK_HOSTS.has(new URL(url).hostname)) {
  console.error('--header needs an https:// target (or http:// on localhost, 127.0.0.1 or [::1]): over plain http the header would be sent unencrypted');
  process.exit(2);
}
const originOf = (u) => { try { return new URL(u).origin; } catch { return null; } };
// Protocol errors that only mean the request is gone (page closed, navigation cancelled).
const isGoneRequest = (e) => /Invalid InterceptionId|Target closed|Session closed|has been closed/i.test(String(e?.message));

// Adds `name: value` to each request whose origin is `origin`, and to no other.
// Chromium's own Fetch interception is used rather than Playwright's extraHTTPHeaders
// (sent to every origin) or route.continue({ headers }) (Playwright re-applies those to
// every redirect hop, so a same-origin URL redirecting elsewhere would carry the header
// there). Fetch.continueRequest header overrides do not extend to redirect hops, and
// Chromium pauses each hop again, so every hop is judged by its own origin. TLS stays
// with Chromium: the header is attached before the connection is made, and a failed
// certificate check aborts it before any byte of the request is sent.
async function sendHeaderToOriginOnly(page, origin, name, value) {
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Fetch.requestPaused', (e) => {
    const params = { requestId: e.requestId };
    if (origin !== 'null' && originOf(e.request.url) === origin) {
      params.headers = Object.entries(e.request.headers)
        .filter(([n]) => n.toLowerCase() !== name.toLowerCase())
        .map(([n, v]) => ({ name: n, value: v }))
        .concat({ name, value });
    }
    cdp.send('Fetch.continueRequest', params)
      .catch((err) => { if (!isGoneRequest(err)) console.error(`header routing: ${err.message} (${e.request.url})`); });
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
}
// Measures :hover and :focus-visible on every interactive element, one element at a
// time. Forcing the whole set at once is a state no user can reach — every control
// hovered simultaneously — and an ancestor, sibling or :has() selector then resolves
// against that fiction.
const INTERACTIVE = 'a, button, input, textarea, select, summary, [tabindex]';
// What the focus passes judge: an <a> without href (a named anchor) can be hovered, not
// focused, and a tabindex="-1" element without a role (a skip-link target, a heading that
// receives focus after navigation) is a focus target, not a user interface component.
// A tabindex="-1" element counts only with a widget role (a roving-tabindex tab or
// option); inert content and a tabindex="-1" element under aria-hidden (a card's
// duplicate image link) are never reached by keyboard.
const WIDGET_ROLES = ['button', 'checkbox', 'combobox', 'gridcell', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'row', 'slider', 'spinbutton', 'switch', 'tab', 'treeitem'];
const FOCUSABLE = `:is(a[href], button, input, textarea, select, summary, [tabindex]:not([tabindex^="-"]), [tabindex]:is(${WIDGET_ROLES.map((r) => `[role="${r}"]`).join(', ')}))`
  + ':not([inert], [inert] *, [aria-hidden="true"][tabindex^="-"], [aria-hidden="true"] [tabindex^="-"])';
// A node can legitimately disappear between the query and the force. Anything else is
// a real failure and must not be swallowed: an element silently dropped here is an
// element whose hover colour nobody measured, in a run that still exits 0.
const isDetached = (e) => /Could not find node|No node (found )?with given id|Node with given id does not belong/i.test(String(e?.message));

// `fn` names the in-page measurement: __measureOne (text colour), __ringBefore or
// __measureFocusRing (focus indicator).
async function measureOneNode(cdp, nodeId, state, fn = '__measureOne') {
  const { object } = await cdp.send('DOM.resolveNode', { nodeId });
  // No throw from a finally anywhere here: it would replace the measurement error
  // with whatever the cleanup said. Both are captured and reported together.
  let value;
  let measureError;
  try {
    const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId, returnByValue: true,
      functionDeclaration: `function (state) { return window.${fn}(this, state); }`,
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

// `scope` narrows both passes to the elements that also match it (an attribute selector);
// `seen` is shared by every call of one run, so a failure is reported once.
async function measureInteractiveStates(page, scope = '', seen = new Set()) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('Runtime.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: `:is(${INTERACTIVE})${scope}` });
  const focusable = new Set((await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: `${FOCUSABLE}${scope}` })).nodeIds);
  const failures = [];
  const focusFailures = [];
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
      if (state === 'focus-visible' && !focusable.has(nodeId)) continue;
      let forced = false;
      try {
        // A browser never shows :focus-visible without :focus; a colour set under :focus
        // alone must be measured too.
        const forcedPseudoClasses = state === 'focus-visible' ? ['focus', 'focus-visible'] : [state];
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses });
        forced = true;
        const f = await measureOneNode(cdp, nodeId, state);
        const key = f && `${state}|${f.element}|${f.fg}|${f.bg}`;
        if (f && !seen.has(key)) { seen.add(key); failures.push(f); }
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
  // Focus indicators: what an element shows unfocused is recorded first, then :focus and
  // :focus-visible are forced together (a browser never shows one without the other) and
  // only what changed is judged (the page was blurred before the first pass). One element
  // at a time, like the pass above: a forced state must be reset before the next element
  // is recorded.
  for (const nodeId of aborted ? [] : nodeIds.filter((id) => focusable.has(id))) {
    let forced = false;
    try {
      await measureOneNode(cdp, nodeId, 'unfocused', '__ringBefore');
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] });
      forced = true;
      const ring = await measureOneNode(cdp, nodeId, 'focus', '__measureFocusRing');
      const ringKey = ring && `ring|${ring.element}|${ring.color}|${ring.against}`;
      if (ring && !seen.has(ringKey)) { seen.add(ringKey); focusFailures.push(ring); }
    } catch (e) {
      if (!isDetached(e)) { errors.push(e); break; }
    } finally {
      if (forced) await reset(nodeId);
    }
  }
  // A session left attached would stay open for the rest of the run; a failure to detach
  // changes no measurement.
  try { await cdp.detach?.(); } catch (e) { /* nothing measured depends on it */ }
  if (errors.length) {
    const [first, ...rest] = errors;
    if (rest.length) first.message += ` (+${rest.length} more: ${rest.map((e) => e.message).join('; ')})`;
    throw first;
  }
  return { failures, focusFailures };
}

// Scrolls through the page one viewport at a time, instantly (a smooth scroll-behavior
// would only start an animation that the next step restarts), so content revealed on
// scroll (an IntersectionObserver adding a class, a scroll-triggered animation) is
// revealed, then back to the top. Covers the height as loaded, at most 200 viewports.
// For every control, the first position where it is visible at a non-zero opacity is
// recorded in __seenAt: a control at opacity 0 at the top that was visible further down
// (a reveal that hides again when scrolled away, a header button shown once the page
// scrolls) is measured at that position, where the page looks as the user saw it. In
// the page.
// A control that exists only while the page is scrolled (a back-to-top button a framework
// mounts past some offset) is not in the page at the top: the positions where such a
// control was visible are recorded in __mountedAt, and every control visible there that
// is not in the page at the top is measured there.
async function revealOnScroll(selector) {
  const frame = () => window.__auditFrame();
  window.__seenAt = new Map();
  window.__mountedAt = new Set();
  const initial = new WeakSet(document.querySelectorAll(selector));
  const record = (y) => {
    for (const el of document.querySelectorAll(selector)) {
      if (!el.checkVisibility({ opacityProperty: true, checkOpacity: true, visibilityProperty: true })) continue;
      if (window.__seenAt.has(el)) continue;
      window.__seenAt.set(el, y);
      if (!initial.has(el)) window.__mountedAt.add(y);
    }
  };
  const max = Math.min(document.documentElement.scrollHeight, innerHeight * 200);
  for (let y = 0; y < max; y += innerHeight) { scrollTo({ top: y, behavior: 'instant' }); await frame(); record(scrollY); }
  scrollTo({ top: 0, behavior: 'instant' });
  await frame();
}

// Every animation (CSS or Web Animations API) is put into the state a user sees once it
// has run: an infinite one (a spinner, a blink) is cancelled, so its element shows its
// rest style (a control a CSS-only carousel shows was recorded by revealOnScroll and is
// measured even at rest opacity 0); a finite one is finished, unless that leaves its
// element less visible (a toast that fades out after a delay), in which case it is
// cancelled. In the page.
function settleAnimations() {
  const seen = (a) => {
    const t = a.effect?.target;
    if (!t) return 1;
    const cs = getComputedStyle(t, a.effect.pseudoElement || null);
    return cs.visibility === 'hidden' ? 0 : Number.parseFloat(cs.opacity);
  };
  for (const a of document.getAnimations()) {
    // A scroll-driven animation (animation-timeline: scroll() or view()) shows the state
    // of the current scroll position; finishing it would pin its end state at the top.
    if (a.timeline && !(a.timeline instanceof DocumentTimeline)) continue;
    const before = seen(a);
    // finish() throws InvalidStateError for an infinite animation, which is cancelled.
    try { a.finish(); } catch (e) { a.cancel(); continue; }
    if (seen(a) < before - 0.01) a.cancel();
  }
}

// Fingerprints of the computed colours, one per entry of `attrs`: null for the page as
// it is, a value for the page with that data-theme set (and then restored). In the page.
function colourFingerprints(attrs) {
  const html = document.documentElement;
  const prev = html.dataset.theme;
  const take = () => [...document.querySelectorAll('html, body, body *')].slice(0, 3000).map((e) => {
    const c = getComputedStyle(e); return [c.color, c.backgroundColor, c.borderTopColor].join('/');
  }).join('|');
  const out = attrs.map((attr) => {
    if (attr) html.dataset.theme = attr;
    return take();
  });
  if (prev === undefined) delete html.dataset.theme; else html.dataset.theme = prev;
  return out;
}

// Which mechanisms switch this page's colours. Detected from computed colours, not by
// scanning stylesheets: Chromium refuses `cssRules` on a cross-origin sheet and on any
// external sheet of a file:// page, and a scan then reports "no dark scheme" for a page
// whose dark palette renders.
async function detectDarkScheme(page, scheme) {
  const other = scheme === 'dark' ? 'light' : 'dark';
  const [base] = await page.evaluate(colourFingerprints, [null]);
  const by = [];
  await page.emulateMedia({ colorScheme: other });
  try {
    const [flipped] = await page.evaluate(colourFingerprints, [null]);
    if (flipped !== base) by.push('prefers-color-scheme');
  } finally {
    await page.emulateMedia({ colorScheme: scheme });
  }
  // data-theme switches the scheme when "dark" and "light" give different colours. Not
  // when either differs from the page as loaded: on a page with a named theme
  // (data-theme="corporate"), setting either value only drops that theme's rules.
  const [dark, light] = await page.evaluate(colourFingerprints, ['dark', 'light']);
  if (dark !== light) by.push('data-theme');
  return by;
}

// Exported when required as a module so the error paths can be tested against a
// stubbed CDP session; running the file as a CLI is unaffected.
if (!CLI) { module.exports = { measureOneNode, measureInteractiveStates, isDetached }; }

(async () => {
  if (!CLI) return;
  const browser = await chromium.launch({ headless: true });
  // ignoreHTTPSErrors stays false unless --insecure was given, and --insecure excludes
  // --header (checked above), so the header never reaches an https server whose
  // certificate failed verification.
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: insecure, colorScheme: scheme });
  const page = await ctx.newPage();
  // A page's own mouseout or pointerout listener on <html> or <body> runs before anything
  // the audit can add there, and an exit-intent popup opens from it when the pointer leaves
  // the window. Such listeners are wrapped before the page runs, so they skip the one leave
  // the audit causes (window.__auditLeaving); removeEventListener finds the wrapper.
  await page.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    const wrapped = new WeakMap();
    // Timers the page sets while the audit's leave runs: native copies, taken before any page script.
    const st = window.setTimeout; const ct = window.clearTimeout; const pending = new Set();
    Object.defineProperty(window, '__auditTimers', { value: { pending } });
    const si = window.setInterval; const ci = window.clearInterval; let inherit = 0;
    // The audit's frame waits use the native requestAnimationFrame, so a page that
    // replaces or stubs it cannot stall the run.
    const raf = window.requestAnimationFrame;
    Object.defineProperty(window, '__auditFrame', { value: () => new Promise((r) => { raf.call(window, () => raf.call(window, r)); }) });
    // A timeout leaves `pending` when it fires; an interval stays until clearInterval.
    const track = (native, fn, ms, args, self, repeat) => {
      const tracked = (window.__auditLeaving || window.__auditReplaying || inherit > 0) && !(Number(ms) > 1000);
      // A string handler goes to the native function as it is. For a string timeout, native
      // timers due at the same time just before and after it open and close its inherit
      // window; a string interval gets none, so the timers its ticks set are not followed.
      if (typeof fn !== 'function') {
        let id; let open = false;
        if (tracked && !repeat) st(() => { if (pending.has(id)) { open = true; inherit++; } }, ms);
        id = native.call(self, fn, ms, ...args);
        if (tracked) { pending.add(id); if (!repeat) st(() => { pending.delete(id); if (open) inherit--; }, ms); }
        return id;
      }
      const id = native.call(self, function (...x) {
        const mine = repeat ? pending.has(id) : pending.delete(id); if (mine) inherit++;
        // Released by a native 0 ms timer: the callback's microtask continuations, at any depth, run first.
        try { return fn.apply(this, x); } finally { if (mine) st(() => { inherit--; }, 0); }
      }, ms, ...args);
      if (tracked) pending.add(id); return id;
    };
    window.setTimeout = function (fn, ms, ...args) { return track(st, fn, ms, args, this, false); };
    window.setInterval = function (fn, ms, ...args) { return track(si, fn, ms, args, this, true); };
    window.clearTimeout = function (id) { pending.delete(id); return ct.call(this, id); };
    window.clearInterval = function (id) { pending.delete(id); return ci.call(this, id); };
    const guarded = (target, type, fn) => (target === document.documentElement || target === document.body)
      && (type === 'mouseout' || type === 'pointerout') && (typeof fn === 'function' || (typeof fn === 'object' && fn !== null)) && !fn.__audit;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (guarded(this, type, fn)) {
        // A listener object's handleEvent is looked up when the event arrives, as the DOM does.
        if (!wrapped.has(fn)) { const orig = fn; wrapped.set(fn, function (e) { if (window.__auditLeaving && !e.relatedTarget) { (window.__auditSkipped ||= []).push({ orig, ctx: this, e, path: e.composedPath(), phase: e.eventPhase }); return undefined; } return typeof orig === 'function' ? orig.call(this, e) : orig.handleEvent(e); }); }
        return add.call(this, type, wrapped.get(fn), opts);
      }
      return add.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      return remove.call(this, type, guarded(this, type, fn) && wrapped.has(fn) ? wrapped.get(fn) : fn, opts);
    };
  });
  if (header) await sendHeaderToOriginOnly(page, originOf(url), header.split(':')[0].trim(), header.split(':').slice(1).join(':').trim());
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
  // The headless mouse rests at (0, 0), so an element there (a fixed header's logo link)
  // is really hovered and would be measured in its :hover colours as if at rest. Hover is
  // measured on purpose by forcing it, one element at a time; the pointer stays outside.
  await page.evaluate(() => {
    const top = (t) => t === document || t === document.documentElement || t === document.body;
    window.__stopLeave = (e) => { if (top(e.target)) e.stopImmediatePropagation(); };
    window.__stopOut = (e) => { if (!e.relatedTarget) e.stopPropagation(); }; window.__stopOut.__audit = true;
    for (const t of ['mouseleave', 'pointerleave']) window.addEventListener(t, window.__stopLeave, true);
    for (const t of ['mouseout', 'pointerout']) { window.addEventListener(t, window.__stopLeave, true); document.documentElement.addEventListener(t, window.__stopOut); }
  });
  // An onmouseout or onpointerout handler (property or attribute) on <html> or <body> is not
  // an addEventListener call: it is taken off for the rest of the run, in which no mouse
  // event reaches the page again (hover and focus are forced).
  await page.evaluate(() => {
    window.__auditLeaving = true;
    for (const el of [document.documentElement, document.body]) {
      for (const prop of ['onmouseout', 'onpointerout']) if (el?.[prop]) el[prop] = null;
    }
  });
  await page.mouse.move(-10, -10);
  await page.evaluate(() => { window.__auditReplaying = true; window.__auditLeaving = false;
    // The leave a wrapped listener skipped is replayed with <body> as relatedTarget:
    // a delegated hover-out releases, an exit-intent check for a null relatedTarget stays shut.
    // The related target is inside the document (an exit check that tests contains() stays
    // shut) and, on a page with a <body>, is not <html> (the classic relatedTarget-or-HTML
    // check stays shut either).
    const rel = document.body ?? document.documentElement;
    for (const { orig, ctx, e, path, phase } of window.__auditSkipped ?? []) {
      const b = e.target.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
      const cx = b.left + b.width / 2; const cy = b.top + b.height / 2;
      const over = { relatedTarget: rel, toElement: rel, currentTarget: ctx, composedPath: () => path, eventPhase: phase, clientX: cx, clientY: cy, x: cx, y: cy, pageX: cx + scrollX, pageY: cy + scrollY };
      const ev = new Proxy(e, { get: (t, k) => (k in over ? over[k] : (typeof t[k] === 'function' ? t[k].bind(t) : t[k])) });
      try { typeof orig === 'function' ? orig.call(ctx, ev) : orig.handleEvent(ev); } catch (err) { /* a page error stays the page's */ }
    } });
  await page.evaluate(() => {
    for (const t of ['mouseleave', 'pointerleave', 'mouseout', 'pointerout']) window.removeEventListener(t, window.__stopLeave, true);
    for (const t of ['mouseout', 'pointerout']) document.documentElement.removeEventListener(t, window.__stopOut);
  });
  // A hover-out may run after a delay (hover intent, usually 100 to 500 ms). Timers and
  // intervals of at most 1 s that the page set while the audit's leave ran, and those they
  // set in turn (also after an await, not after a wait for a frame, a fetch or an event, and
  // not from a string interval), are
  // waited for (an interval until it is cleared), at most 1 s in total; the page's other timers run on as
  // they would anyway (a toast is measured as before). The page sees wrapped setTimeout,
  // setInterval, clearTimeout and clearInterval; a string handler runs as it would.
  await page.evaluate(() => { window.__auditReplaying = false; });
  await page.waitForFunction(() => window.__auditTimers.pending.size === 0, null, { timeout: 1000, polling: 50 }).catch(() => {});
  // Kill transitions before measuring anything: see the note on stateFailures above.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important}' });
  // Content revealed on scroll and every animation are put into the state a user sees:
  // `animation: none` would leave a fade-in at its starting opacity 0.
  await page.evaluate(revealOnScroll, INTERACTIVE);
  await page.evaluate(settleAnimations);
  // An element focused on load (autofocus) would be measured in its focused colours, and
  // the focus-indicator pass would record it focused: nothing may hold focus.
  await page.evaluate(() => document.activeElement?.blur?.());
  // A palette switched by data-theme is not reached by emulating prefers-color-scheme:
  // where data-theme switches the colours, the run sets it to its own scheme.
  // A value of the page's own other than light or dark (a named theme) is kept and
  // reported in dataThemeKept: it is what the page ships.
  const darkSchemeBy = await detectDarkScheme(page, scheme);
  const ownTheme = await page.evaluate(() => document.documentElement.dataset.theme ?? null);
  const dataThemeSet = darkSchemeBy.includes('data-theme') && [null, 'light', 'dark'].includes(ownTheme);
  if (dataThemeSet) await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, scheme);
  // The browser's focus-ring colours, read in a page of their own so the audited page
  // sees no probe: one per color-scheme.
  const probePage = await browser.newPage();
  await probePage.setContent('<span style="color-scheme:light;outline-color:-webkit-focus-ring-color"></span><span style="color-scheme:dark;outline-color:-webkit-focus-ring-color"></span>');
  const [light, dark] = await probePage.evaluate(() => [...document.querySelectorAll('span')].map((e) => getComputedStyle(e).outlineColor));
  const uaRings = { light, dark, scheme };
  await probePage.close();
  const result = await page.evaluate((uaRings) => {
    // Colours: rgb()/rgba() are read numerically, exactly; any other notation the browser
    // computes (oklch(), color()) goes through a 1x1 canvas, which returns sRGB bytes with
    // 8-bit alpha. Filling over two different colours tells an unparseable value (it leaves
    // the fill as it was) from a real one: null, never black.
    const ctx2d = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    const colourCache = new Map();
    const RGB_FN = /^rgba?\(([^)]*)\)$/;
    const channel = (x) => (x.endsWith('%') ? Number.parseFloat(x) * 2.55 : Number.parseFloat(x));
    const alpha = (x) => {
      if (x === undefined) return 1;
      return x.endsWith('%') ? Number.parseFloat(x) / 100 : Number.parseFloat(x);
    };
    const viaCanvas = (c) => {
      const fill = (sentinel) => {
        ctx2d.clearRect(0, 0, 1, 1);
        ctx2d.fillStyle = sentinel;
        ctx2d.fillStyle = c;
        ctx2d.fillRect(0, 0, 1, 1);
        return ctx2d.getImageData(0, 0, 1, 1).data;
      };
      const a = fill('#000000');
      const b = fill('#ffffff');
      if (!a.every((x, i) => x === b[i])) return null;
      return { r: a[0], g: a[1], b: a[2], a: a[3] / 255 };
    };
    const parse = (c) => {
      if (!c) return null;
      if (colourCache.has(c)) return colourCache.get(c);
      const m = RGB_FN.exec(c.trim());
      let v;
      if (m) {
        const n = m[1].split(/[\s,/]+/).filter(Boolean);
        v = { r: channel(n[0]), g: channel(n[1]), b: channel(n[2]), a: alpha(n[3]) };
      } else {
        v = viaCanvas(c);
      }
      colourCache.set(c, v);
      return v;
    };
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    // Composite the translucent layers instead of taking the first one at face value:
    // rgba(255,255,255,.18) over a teal hero is NOT white, and reading it as white both
    // invents failures and hides them.
    const bgOf = (el) => {
      const stack = [];
      while (el) { const ecs = getComputedStyle(el); const c = ecs.display === 'contents' ? null : parse(ecs.backgroundColor);
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
    const restFail = new WeakMap();
    const apcaSeen = new Map();
    let smallest = Infinity;
    let exempt = 0;
    // <title>/<desc> inside an SVG are accessible names, never painted; script/style/
    // template hold source text. None of them have a rendered contrast.
    // An SVG element's className is an SVGAnimatedString; its baseVal is the class list.
    const cls = (el) => String(el.className?.baseVal ?? el.className ?? '').trim();
    const describe = (el) => { const c = cls(el); return el.tagName.toLowerCase() + (c ? '.' + c.replaceAll(/\s+/g, '.') : ''); };
    const NOT_PAINTED = new Set(['TITLE', 'DESC', 'SCRIPT', 'STYLE', 'TEMPLATE', 'METADATA', 'NOSCRIPT']);
    // Hidden by its own or an ancestor's display: none, or by visibility (inherited, so an
    // ancestor's counts unless the element overrides it). Not checkVisibility(): that also
    // drops a closed <details>, a <select>'s options and display: contents, which paint.
    window.__displayed = (el) => { for (let a = el; a; a = a.parentElement) if (getComputedStyle(a).display === 'none') return false;
      return !['hidden', 'collapse'].includes(getComputedStyle(el).visibility); };
    window.__painted = (el) => {
      if (el.checkVisibility({ visibilityProperty: true })) return true;
      if (!(getComputedStyle(el).display === 'contents' || el.closest('details:not([open]), select'))) return false;
      return window.__displayed(el);
    };
    // A closed single-line <select> paints its selected option's text in its own colour.
    const singleSelect = (el) => el.tagName === 'SELECT' && !el.multiple && el.size <= 1;
    const directText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const ownText = (el) => (singleSelect(el) ? (el.selectedOptions[0]?.textContent ?? '').trim() : directText(el));
    // The text a report names: the shown value of a single-line select, else the content.
    const shownText = (el) => (singleSelect(el) ? el.selectedOptions[0]?.textContent ?? '' : el.textContent).trim().slice(0, 40);
    // An option of a single-line <select> that shows a value, in the select's own colours,
    // is measured on the select; with no value shown, the options are measured themselves.
    const isShownOption = (el, cs, bg) => {
      const box = el.tagName === 'OPTION' && el.closest('select');
      return !!box && singleSelect(box) && !!ownText(box) && getComputedStyle(box).color === cs.color && JSON.stringify(bgOf(box)) === JSON.stringify(bg);
    };
    // The text pass over a set of elements, each with its own text in its own colour. Run
    // on the whole page here, and later on the subtree of each control measured at another
    // scroll position, into the same results.
    window.__textIn = (elements) => { for (const el of elements) {
      if (NOT_PAINTED.has(el.tagName.toUpperCase())) continue;
      if (!ownText(el)) continue;
      const cs = getComputedStyle(el);
      // Hidden by its own or an ancestor's display or visibility: not painted.
      if (!window.__painted(el)) continue;
      // A style guide legitimately shows failing pairs as specimens. They must be declared
      // with data-contrast-demo, and the count is reported so the exemption is visible.
      if (el.closest('[data-contrast-demo]')) { exempt++; continue; }
      const size = Number.parseFloat(cs.fontSize); smallest = Math.min(smallest, size);
      const fg = parse(cs.color); const bg = bgOf(el); const r = ratio(fg, bg);
      const weight = Number.parseInt(cs.fontWeight, 10) || 400;
      const bold = weight >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      if (isShownOption(el, cs, bg)) {
        // Its failure is the select's; recorded so the state pass does not repeat it.
        if (r < need) { if (!restFail.has(el)) restFail.set(el, new Set()); restFail.get(el).add(`${cs.color}|${bg.r},${bg.g},${bg.b}`); }
        continue;
      }
      const lc = apcaLc(fg, bg);
      const lcNeed = apcaRequired(size, weight);
      if (lcNeed !== null && Math.abs(lc) < lcNeed) {
        const akey = `apca|${el.tagName}.${cls(el)}|${cs.color}|${bg.r},${bg.g},${bg.b}|${size}`;
        if (!apcaSeen.has(akey)) apcaSeen.set(akey, { element: describe(el), text: shownText(el), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, lc: +lc.toFixed(1), lcRequired: +lcNeed.toFixed(1), fontSize: size, fontWeight: cs.fontWeight });
      }
      if (r < need) {
        const key = `${el.tagName}.${cls(el)}|${cs.color}|${bg.r},${bg.g},${bg.b}`;
        if (!restFail.has(el)) restFail.set(el, new Set());
        restFail.get(el).add(`${cs.color}|${bg.r},${bg.g},${bg.b}`);
        if (!seen.has(key)) seen.set(key, { element: describe(el), text: shownText(el), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +r.toFixed(2), required: need, fontSize: size });
      }
    } };
    window.__textIn(document.querySelectorAll('body *'));
    window.__textSummary = () => ({ contrastFailures: [...seen.values()], apcaWarnings: [...apcaSeen.values()], demoExemptElements: exempt, smallestFontPx: +smallest.toFixed(1) });
    // Re-used by the interactive-state pass, which runs after this evaluate returns.
    // Measures ONE element — the one currently forced into `state`. The caller hands
    // it over by object reference (CDP DOM.resolveNode + Runtime.callFunctionOn), so
    // nothing in the page has to be marked or mutated to find it again.
    window.__measureOne = (el, state) => {
      if (!el || el.closest('[data-contrast-demo]')) return null;
      // A control visible only at another scroll position (at opacity 0 here, or hidden by
      // display or visibility) is queued and measured there, not here; this also covers a
      // control the focus passes never see (a link without href, a tabindex="-1" element).
      if (!el.hasAttribute('data-contrast-audit-at') && window.__seenAt?.has(el)
        && !el.checkVisibility({ opacityProperty: true, checkOpacity: true, visibilityProperty: true })) { window.__deferred.add(el); return null; }
      const cs = getComputedStyle(el);
      if (!window.__painted(el)) return null;
      // Each painted text inside the control, in its own colour: in <a><span>Read more</span></a>
      // the colour :hover changes may sit on the <a> (inherited) or on the <span>. The text of
      // an SVG <title> or <desc> is an accessible name, never painted, and is left out.
      let worst = null;
      let worstRatio = Infinity;
      for (const t of [el, ...el.querySelectorAll('*')]) {
        if (NOT_PAINTED.has(t.tagName.toUpperCase()) || !ownText(t)) continue;
        if (!window.__painted(t)) continue;
        if (t.closest('[data-contrast-demo]')) continue;
        const ts = t === el ? cs : getComputedStyle(t);
        const fg = parse(ts.color); const bg = bgOf(t); const r = ratio(fg, bg);
        const size = Number.parseFloat(ts.fontSize);
        const bold = (Number.parseInt(ts.fontWeight, 10) || 400) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        // A text that fails the same way at rest is reported there already, not again here.
        if (r >= need || restFail.get(t)?.has(`${ts.color}|${bg.r},${bg.g},${bg.b}`)) continue;
        // Compared unrounded, so on a tie the control keeps the report (a select over its
        // shown option, which inherits the select's colours).
        if (r < worstRatio) {
          worstRatio = r;
          worst = { state, element: describe(el) + (t === el ? '' : ` ${describe(t)}`), text: ownText(t).slice(0, 40), fg: ts.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +r.toFixed(2), required: need, fontSize: size };
        }
      }
      return worst;
    };

    // SC 1.4.11 for non-text parts. A translucent colour is measured as it renders,
    // composited over what lies behind it.
    const rgb = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
    // The colour a pixel of `el` renders as: each ancestor's background under what lies
    // above it, each ancestor's opacity applied to its whole subtree (a group), over white.
    // `top` is a colour drawn on that pixel; with `ownBg` false the pixel lies outside el's
    // box (an outline, an outer ring), where el paints only `top`. Opacity 0 is left out:
    // such a control is skipped, or measured where it was visible.
    const paint = (el, top = null, ownBg = true) => {
      let C = top ? { r: top.r * top.a, g: top.g * top.a, b: top.b * top.a } : { r: 0, g: 0, b: 0 };
      let A = top ? top.a : 0;
      for (let e = el, first = true; e; e = e.parentElement, first = false) {
        const ecs = getComputedStyle(e);
        if (ecs.display === 'contents') continue;
        const c = first && !ownBg ? null : parse(ecs.backgroundColor);
        if (c && c.a > 0) { C = { r: C.r + c.r * c.a * (1 - A), g: C.g + c.g * c.a * (1 - A), b: C.b + c.b * c.a * (1 - A) }; A += c.a * (1 - A); }
        const o = Number.parseFloat(ecs.opacity);
        if (o > 0 && o < 1) { C = { r: C.r * o, g: C.g * o, b: C.b * o }; A *= o; }
      }
      return { r: C.r + 255 * (1 - A), g: C.g + 255 * (1 - A), b: C.b + 255 * (1 - A), a: 1 };
    };
    // Whether a control can be seen and used at all: a closed <dialog>, a display:none or
    // visibility:hidden ancestor, opacity 0 on the control or an ancestor (a custom switch's
    // input over its drawn track, a closed popover), a disabled control (also inside
    // <fieldset disabled>) and a 1px visually hidden form field (its look is drawn by a
    // sibling) have no visible state. Animations are settled first, so a fade-in counts
    // at its final opacity. A control at opacity 0 here is measured at the scroll position
    // where it was visible, or, if there was none, counted in transparentControlsSkipped,
    // so a skip is visible in the report.
    window.__transparent = new Set();
    // Controls at opacity 0 here that were visible at another scroll position: measured
    // there afterwards.
    window.__deferred = new Set();
    const perceivable = (el) => {
      if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return false;
      if (!el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })) return false;
      if (!el.checkVisibility({ opacityProperty: true, checkOpacity: true }) && !el.hasAttribute('data-contrast-audit-at')) {
        (window.__seenAt?.has(el) ? window.__deferred : window.__transparent).add(el);
        return false;
      }
      if (!el.matches('input, select, textarea')) return true;
      const b = el.getBoundingClientRect();
      return b.width > 1 && b.height > 1;
    };
    // Chromium writes a computed shadow layer colour first: a function up to its closing
    // parenthesis, or a single word.
    const leadingColour = (layer) => {
      const paren = layer.indexOf('(');
      const space = layer.indexOf(' ');
      if (paren > 0 && (space === -1 || paren < space)) {
        let depth = 0;
        for (let i = paren; i < layer.length; i++) {
          if (layer[i] === '(') depth++;
          if (layer[i] === ')' && --depth === 0) return layer.slice(0, i + 1);
        }
        return layer;
      }
      return space === -1 ? layer : layer.slice(0, space);
    };
    // A box-shadow value split into its layers (commas inside colour functions kept).
    const shadowLayers = (v) => {
      if (!v || v === 'none') return [];
      const out = []; let depth = 0; let cur = '';
      for (const ch of v) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else { cur += ch; }
      }
      if (cur.trim()) out.push(cur.trim());
      return out.map((layer) => {
        const colour = leadingColour(layer);
        const rest = layer.slice(colour.length).split(/\s+/);
        const lengths = rest.filter((t) => t.endsWith('px')).map(Number.parseFloat);
        return { text: layer, colour, inset: rest.includes('inset'), blur: lengths[2] || 0, spread: lengths[3] || 0 };
      });
    };
    // A ring layer's colour at the pixel next to the border: a blur is a Gaussian with a
    // standard deviation of half the blur radius (CSS Backgrounds 3). At the border edge the
    // layer reaches Phi(spread / sigma) of its alpha; that pixel's centre lies half a pixel
    // further out, and an inset ring paints lighter still, so one pixel is taken off the
    // spread of an outer ring and two off an inset one (matched to Chromium screenshots).
    const erf = (x) => { const t = 1 / (1 + 0.3275911 * x);
      return 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); };
    const ringColour = (layer, c) => (layer.blur > 0 ? { ...c, a: c.a * 0.5 * (1 + erf(Math.max(0, (2 * layer.spread - (layer.inset ? 2 : 1)) / layer.blur) / Math.SQRT2)) } : c);
    const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
    const ringState = (el) => {
      const cs = getComputedStyle(el);
      return {
        outline: `${cs.outlineStyle}|${cs.outlineWidth}|${cs.outlineColor}`,
        offset: cs.outlineOffset,
        shadows: shadowLayers(cs.boxShadow).map((l) => l.text),
        borders: SIDES.map((sd) => ['Style', 'Width', 'Color'].map((p) => cs['border' + sd + p]).join('|')),
      };
    };
    // The focus indicator of ONE element: what changes between its unfocused state
    // (__ringBefore) and :focus plus :focus-visible. Each changed part is measured where
    // it is drawn: an outline or an outer ring against the parent's background, an inset
    // outline or ring against the element's own, a border (painted over the element's
    // fill) against the parent's. The indicator passes when any changed part reaches 3:1.
    // A permanent shadow is not an indicator; an element whose focus changes no outline,
    // ring or border is counted in focusWithoutRing; the browser's own `outline: auto` ring,
    // which SC 1.4.11 leaves to the user agent, in focusUserAgentRing. A ring drawn on
    // another element (a sibling label, a :focus-within ancestor) is not seen.
    // A changed, visible outline: against the parent's background, or the element's own
    // when it is drawn inside (negative offset).
    // Whether focus changed the outline. A moved outline counts, except the moves of
    // Chromium's own focus styles, which would make a permanent outline look like a focus
    // indicator: 0 to 1px on a link, 0 to 2px on a checkbox or radio.
    const UA_OFFSET = [[':any-link', '1px'], ['input[type=checkbox], input[type=radio]', '2px']];
    const outlineChanged = (el, before, after) => {
      if (after.outline !== before.outline) return true;
      if (after.offset === before.offset) return false;
      return !(before.offset === '0px' && UA_OFFSET.some(([sel, px]) => el.matches(sel) && after.offset === px));
    };
    const outlinePart = (el, cs, before, after) => {
      const width = Number.parseFloat(cs.outlineWidth);
      if (!outlineChanged(el, before, after) || cs.outlineStyle === 'none' || Number.isNaN(width) || width <= 0) return [];
      const c = parse(cs.outlineColor);
      if (!c || c.a === 0) return [];
      const inside = (Number.parseFloat(cs.outlineOffset) || 0) < 0;
      return [{ indicator: 'outline', shown: paint(el, c, inside), against: inside ? paint(el) : paint(el.parentElement) }];
    };
    // Each new shadow layer with a spread (a ring): inset against the element's own
    // background, outer against the parent's.
    const shadowParts = (el, cs, before) => shadowLayers(cs.boxShadow)
      .filter((layer) => !before.shadows.includes(layer.text) && layer.spread > 0)
      .map((layer) => ({ layer, c: parse(layer.colour) }))
      .filter(({ c }) => c && c.a > 0)
      .map(({ layer, c }) => ({ indicator: 'box-shadow', shown: paint(el, ringColour(layer, c), layer.inset), against: layer.inset ? paint(el) : paint(el.parentElement) }));
    // Each changed, visible border side, painted over the element's fill unless
    // background-clip stops the fill short of it, against the parent's background.
    const borderParts = (el, cs, before, after) => SIDES.flatMap((sd, k) => {
      const p = 'border' + sd;
      if (after.borders[k] === before.borders[k] || cs[p + 'Style'] === 'none') return [];
      const w = Number.parseFloat(cs[p + 'Width']);
      const c = parse(cs[p + 'Color']);
      if (Number.isNaN(w) || w <= 0 || !c || c.a === 0) return [];
      return [{ indicator: 'border', shown: paint(el, c, cs.backgroundClip === 'border-box'), against: paint(el.parentElement) }];
    });
    // An `outline: auto` ring is the browser's own when it has the browser's focus-ring
    // colour (uaRings, read in a separate page) for el's used color-scheme: its computed
    // keywords (or the color-scheme meta tag for `normal`) against the scheme the run emulates.
    const keys = (v) => (v || '').split(/[\s,]+/).filter((x) => x === 'light' || x === 'dark');
    const isUaRingColour = (el, c) => { let k = keys(getComputedStyle(el).colorScheme);
      // The meta content is parsed as CSS parses it, on a detached element: keywords
      // case-insensitive, a comma list invalid (light).
      if (getComputedStyle(el).colorScheme === 'normal') {
        const st = document.createElement('span').style;
        st.colorScheme = document.querySelector('meta[name="color-scheme" i]')?.content ?? '';
        k = keys(st.colorScheme);
      }
      const used = !k.length ? 'light' : k.includes(uaRings.scheme) ? uaRings.scheme : k[0];
      return c === uaRings[used]; };
    const ringBefore = new WeakMap();
    window.__focusWithoutRing = 0;
    window.__focusUserAgentRing = 0;
    window.__ringBefore = (el) => {
      if (el) { ringBefore.set(el, ringState(el)); }
      return null;
    };
    window.__measureFocusRing = (el) => {
      if (!el || el.closest('[data-contrast-demo]') || !perceivable(el)) return null;
      const before = ringBefore.get(el);
      if (!before) return null;
      const cs = getComputedStyle(el);
      const after = ringState(el);
      if (outlineChanged(el, before, after) && cs.outlineStyle === 'auto' && isUaRingColour(el, cs.outlineColor)) { window.__focusUserAgentRing++; return null; }
      const parts = [
        ...outlinePart(el, cs, before, after),
        ...shadowParts(el, cs, before),
        ...borderParts(el, cs, before, after),
      ];
      if (!parts.length) { window.__focusWithoutRing++; return null; }
      const best = parts.map((p) => ({ ...p, r: ratio(p.shown, p.against) })).sort((a, b) => b.r - a.r)[0];
      if (best.r >= 3) return null;
      return { element: describe(el), indicator: best.indicator, color: rgb(best.shown), against: rgb(best.against), ratio: +best.r.toFixed(2), required: 3 };
    };

    // The visible boundary of a form control: its border, a box-shadow ring with a spread,
    // or its own fill where that differs enough from the surface around it. Disabled
    // controls are exempt (SC 1.4.11), and native checkboxes and radios draw their own
    // boundary.
    const NO_BOUNDARY = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'range', 'color', 'file']);
    window.__boundaryOf = (el) => {
      if (NO_BOUNDARY.has(el.type) || el.closest('[data-contrast-demo]') || !perceivable(el)) return null;
      const cs = getComputedStyle(el);
      if ((el.type === 'checkbox' || el.type === 'radio') && cs.appearance !== 'none') return null;
      const outer = paint(el.parentElement);
      const fill = paint(el);
      let best = ratio(fill, outer); let border = null;
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const w = Number.parseFloat(cs[`border${side}Width`]);
        if (cs[`border${side}Style`] === 'none' || Number.isNaN(w) || w <= 0) continue;
        const c = parse(cs[`border${side}Color`]);
        if (!c) continue;
        // The background is painted under the border unless background-clip stops it.
        const shown = paint(el, c, cs.backgroundClip === 'border-box'); const r = ratio(shown, outer);
        if (r > best) { best = r; border = rgb(shown); }
      }
      for (const layer of shadowLayers(cs.boxShadow)) {
        const c = parse(layer.colour);
        if (layer.spread <= 0 || !c || c.a === 0) continue;
        const shown = paint(el, ringColour(layer, c), layer.inset); const r = ratio(shown, outer);
        if (r > best) { best = r; border = rgb(shown); }
      }
      return best < 3 ? { element: describe(el), border, fill: rgb(fill), against: rgb(outer), ratio: +best.toFixed(2), required: 3 } : null;
    };
    const boundaryFailures = [...document.querySelectorAll('input, select, textarea')].map(window.__boundaryOf).filter(Boolean);

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
      controlBoundaryFailures: boundaryFailures,
      // Stylesheets whose rules the browser does not expose to scripts (cross-origin, or
      // any external sheet of a file:// page). Informational: `darkScheme` is measured
      // from computed colours and does not depend on them.
      unreadableStylesheets: [...document.styleSheets].filter((ss) => { try { return !ss.cssRules; } catch (e) { return true; } }).length,
    };
  }, uaRings);
  const reported = new Set();
  const states = await measureInteractiveStates(page, '', reported);
  result.stateFailures = states.failures;
  result.focusRingFailures = states.focusFailures;
  // Controls visible only at another scroll position, measured there: one position at a
  // time, each control marked with an attribute that scopes the state passes to it.
  // Positions in ascending order, as the scroll pass visited them (a header that reacts to
  // the scroll direction looks as it did then).
  const positions = await page.evaluate((sel) => {
    window.__topSet = new WeakSet(document.querySelectorAll(sel));
    // Controls the text pass could not see at the top: hidden by display or visibility,
    // their own or an ancestor's.
    window.__textSkipped = new WeakSet([...document.querySelectorAll(sel)].filter((el) => !window.__painted(el)));
    window.__mountedMeasured = new WeakSet();
    const ys = new Set([...window.__deferred].map((el) => window.__seenAt.get(el)));
    for (const y of window.__mountedAt) ys.add(y);
    return [...ys].sort((a, b) => a - b);
  }, INTERACTIVE);
  for (const y of positions) {
    await page.evaluate(async ({ top, sel }) => {
      scrollTo({ top, behavior: 'instant' });
      await window.__auditFrame();
      // Marked even if it is at opacity 0 again (a carousel slide whose animation was
      // cancelled): it was seen, and opacity does not change the colours measured.
      for (const el of window.__deferred) if (window.__seenAt.get(el) === top) el.setAttribute('data-contrast-audit-at', '');
      // Controls that are not in the page at the top, each measured once.
      for (const el of document.querySelectorAll(sel)) {
        if (window.__topSet.has(el) || window.__mountedMeasured.has(el)) continue;
        if (!el.checkVisibility({ opacityProperty: true, checkOpacity: true, visibilityProperty: true })) continue;
        window.__mountedMeasured.add(el);
        el.setAttribute('data-contrast-audit-at', '');
      }
    }, { top: y, sel: INTERACTIVE });
    // A scroll can start an animation again (a header that animates to its scrolled
    // colours): it is settled like the ones on load.
    await page.evaluate(settleAnimations);
    result.controlBoundaryFailures.push(...await page.evaluate(() => [...document.querySelectorAll('[data-contrast-audit-at]')]
      .filter((el) => el.matches('input, select, textarea')).map(window.__boundaryOf).filter(Boolean)));
    // Resting text of a control the text pass could not see at the top: the same text
    // pass, on the control's subtree, into the same results (reported once per element
    // and colour pair, also for a row a virtualised list renders anew at each position).
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-contrast-audit-at]')) {
        if (window.__textSkipped.has(el) || !window.__topSet.has(el)) window.__textIn([el, ...el.querySelectorAll('*')]);
      }
    });
    const at = await measureInteractiveStates(page, '[data-contrast-audit-at]', reported);
    result.stateFailures.push(...at.failures);
    result.focusRingFailures.push(...at.focusFailures);
    await page.evaluate(() => { for (const el of document.querySelectorAll('[data-contrast-audit-at]')) el.removeAttribute('data-contrast-audit-at'); });
  }
  if (positions.length) await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  Object.assign(result, await page.evaluate(() => window.__textSummary()));
  result.focusWithoutRing = await page.evaluate(() => window.__focusWithoutRing);
  result.focusUserAgentRing = await page.evaluate(() => window.__focusUserAgentRing);
  result.transparentControlsSkipped = await page.evaluate(() => window.__transparent.size);
  if (result.transparentControlsSkipped) {
    console.error(`note: ${result.transparentControlsSkipped} control(s) at opacity 0 at the top were not measured: not visible as the same element at any position the scroll pass reached (the window's own scroll, at most 200 viewports); a control a framework replaces on scroll is measured as the new element`);
  }
  result.darkSchemeBy = darkSchemeBy;
  result.darkScheme = darkSchemeBy.length > 0;
  result.dataThemeSet = dataThemeSet ? scheme : null;
  result.dataThemeKept = !dataThemeSet && ownTheme !== null ? ownTheme : null;
  if (result.dataThemeKept && darkSchemeBy.includes('data-theme')) {
    console.error(`note: data-theme="${result.dataThemeKept}" was kept; the page's data-theme light and dark palettes were not measured`);
  }

  result.scheme = scheme;
  result.failedRequests = badRequests;
  const blocking = badRequests.filter((r) => r.gating);
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
  const failed = result.contrastFailures.length || result.stateFailures.length
    || result.focusRingFailures.length || result.controlBoundaryFailures.length || blocking.length;
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
