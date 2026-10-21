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
 * - Where the colour model passes a ring or a boundary, its painted pixels are judged
 *   again (measuredBy 'pixels'); a control another element covers is counted in
 *   focusRingUnverified or controlBoundaryUnverified instead.
 * - What a user sees is what is measured: text in its own colour (also of a closed
 *   <select>, a closed <details> and display: contents), hover and focus states, content
 *   revealed on scroll or by an animation, and the page at rest once the pointer has
 *   left it without opening an exit-intent popup or leaving a hover on.
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

// WCAG contrast of two rgb() strings, for checking that a failure's colours give its ratio.
function contrastOf(a, b) {
  const lum = (c) => { const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

async function run(page, ...args) {
  const r = await audit(page, ...args);
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

test('a palette only under data-theme="dark" is detected in the dark run too', async () => {
  const { json } = await run(fixture('themedark', '[data-theme="dark"] body{background:#111;color:#eee}', '<p>Text</p>'), '--scheme', 'dark');
  assert.deepStrictEqual(json.darkSchemeBy, ['data-theme']);
});

test('a dark page whose light palette sits under data-theme="light" is detected', async () => {
  const { json } = await run(fixture('themelight', 'body{background:#111;color:#eee}[data-theme="light"] body{background:#fff;color:#000}', '<p>Text</p>'));
  assert.deepStrictEqual(json.darkSchemeBy, ['data-theme']);
});

test('text under :focus alone and the unfocused text of an autofocused element are measured', async () => {
  const { code, json } = await run(fixture('focustext',
    'button{background:#fff;border:1px solid #000;color:#000}'
    + 'button.fc:focus{color:#ccc}' // only under :focus
    + 'button.af2{color:#ccc}button.af2:focus{color:#000}', // weak unless focused, focused on load
    '<button type="button" class="af2" autofocus>Start</button> <button type="button" class="fc">Go</button>'));
  assert.ok(json.contrastFailures.some((f) => f.element === 'button.af2'), `button.af2 must be measured unfocused: ${JSON.stringify(json.contrastFailures)}`);
  assert.ok(json.stateFailures.some((f) => f.element === 'button.fc'), `button.fc must be measured under :focus: ${JSON.stringify(json.stateFailures)}`);
  assert.strictEqual(code, 1);
});

test('a data-theme palette is measured in the run of its scheme', async () => {
  const page = fixture('themefail', '[data-theme="dark"] body{background:#111;color:#333}', '<p>Text</p>');
  const dark = await run(page, '--scheme', 'dark');
  assert.strictEqual(dark.json.dataThemeSet, 'dark');
  assert.ok(dark.json.contrastFailures.length > 0, `the data-theme="dark" palette (1.6:1) must be measured: ${JSON.stringify(dark.json.contrastFailures)}`);
  assert.strictEqual(dark.code, 1);
  const light = await run(page);
  assert.strictEqual(light.json.dataThemeSet, 'light');
  assert.strictEqual(light.code, 0, JSON.stringify(light.json.contrastFailures));
});

test('controls in a fade-in section are measured; the browser\'s own outline moves are not indicators', async () => {
  const { code, json } = await run(fixture('round4',
    '.fade{opacity:0;animation:in .6s forwards}@keyframes in{to{opacity:1}}'
    + 'input.fi{border:1px solid #ddd;background:#fff}' // in the fade-in section: 1.36:1
    + 'input.po{outline:2px solid #eee}' // permanent outline, no focus rule
    + 'a:not([href]){color:#000}a:focus{color:#ccc;outline:2px solid #eee}', // a named anchor cannot take focus
    '<section class="fade"><input class="fi" aria-label="Email"></section>'
    + '<input type="checkbox" class="po" aria-label="Box"> <input type="radio" class="po" aria-label="Dot">'
    + '<a id="top" class="na">Top</a>'));
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element), ['input.fi']);
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.stateFailures, []);
  assert.strictEqual(code, 1);
});

test('a named data-theme is kept and measured as the page ships it', async () => {
  const { code, json } = await run(fixture('named',
    '[data-theme="corporate"] body{color:#aaa}', // 2.32:1 under the page's own theme
    '<script>document.documentElement.dataset.theme = "corporate";</script><p>Text</p>'));
  assert.deepStrictEqual(json.darkSchemeBy, []);
  assert.strictEqual(json.dataThemeSet, null);
  assert.strictEqual(json.dataThemeKept, 'corporate');
  assert.ok(json.contrastFailures.length > 0, `the corporate theme must be measured: ${JSON.stringify(json.contrastFailures)}`);
  assert.strictEqual(code, 1);
  // The same page with a dark palette as well: data-theme switches, and the page's own
  // value is still kept.
  const both = await run(fixture('namedboth',
    '[data-theme="corporate"] body{color:#aaa}[data-theme="dark"] body{background:#111;color:#eee}',
    '<script>document.documentElement.dataset.theme = "corporate";</script><p>Text</p>'));
  assert.deepStrictEqual(both.json.darkSchemeBy, ['data-theme']);
  assert.strictEqual(both.json.dataThemeKept, 'corporate');
  assert.ok(both.json.contrastFailures.length > 0, `the corporate theme must be measured: ${JSON.stringify(both.json.contrastFailures)}`);
});

test('a control that fades in is measured at its end state; a tabindex="-1" target is no indicator', async () => {
  const { code, json } = await run(fixture('round5',
    '.fadeb{opacity:0;animation:in .3s forwards}@keyframes in{to{opacity:1}}'
    + 'button{background:#fff;border:1px solid #000;color:#000}'
    + ':focus-visible{outline:2px solid #ddd}', // 1.36:1 everywhere
    '<h1 tabindex="-1">Title</h1><button type="button" class="fadeb">Fades in</button>'
    + '<div class="tab" role="tab" tabindex="-1">Tab</div>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element).sort(), ['button.fadeb', 'div.tab']);
  assert.strictEqual(code, 1);
});

test('content revealed on scroll and every animation are measured as a user sees them', async () => {
  const { code, json } = await run(fixture('settle',
    'input{background:#fff;border:1px solid #eee}' // 1.16:1 wherever it is measured
    + 'html{scroll-behavior:smooth}.spacer{height:2400px}.reveal{opacity:0}.reveal.in{opacity:1}' // hides again off screen
    + 'input.cs{opacity:0;animation:slide 100s infinite}@keyframes slide{0%,90%{opacity:1}95%,100%{opacity:0}}' // carousel slide
    + 'p.toast{color:#aaa;animation:out .3s 6s forwards}@keyframes out{to{opacity:0;visibility:hidden}}'
    + 'input.bl{animation:blink 1s infinite alternate both}@keyframes blink{from{opacity:1}to{opacity:0}}'
    + 'input.pl{border-color:#000;animation:pulse 1s infinite}@keyframes pulse{from,to{border-color:#eee}}', // passes at rest
    '<p class="toast">Saved</p><input class="bl" aria-label="Blinks"><input class="pl" aria-label="Pulses"><input class="cs" aria-label="Slide"><input class="w" aria-label="Animated by script">'
    + '<div class="spacer"></div><section class="reveal"><input class="r" aria-label="Revealed"></section>'
    + '<script>document.querySelector("input.w").animate([{opacity:0},{opacity:1}],{duration:300,delay:4000,fill:"both"});'
    + 'new IntersectionObserver((es)=>es.forEach((e)=>e.target.classList.toggle("in",e.isIntersecting))).observe(document.querySelector(".reveal"));</script>'));
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element).sort(), ['input.bl', 'input.cs', 'input.r', 'input.w']);
  assert.ok(json.contrastFailures.some((f) => f.element === 'p.toast'), `the toast must be measured before it fades out: ${JSON.stringify(json.contrastFailures)}`);
  assert.strictEqual(json.transparentControlsSkipped, 0);
  assert.strictEqual(code, 1);
});

test('a control shown only after scrolling is measured where it is shown', async () => {
  const { code, json } = await run(fixture('scrolled',
    'header{position:fixed;top:0;left:0;right:0;height:60px;display:flex;gap:16px;align-items:center;background:transparent}'
    + 'header.scrolled{background:#15585E}header input{opacity:0;background:transparent;color:#fff}header.scrolled input{opacity:1}'
    + 'input.lt{border:1px solid #fff}' // 8.11:1 on the scrolled header, 1:1 on the page at the top
    + 'input.dk{border:1px solid #1E6A71}' // 1.3:1 on the scrolled header, 6.26:1 at the top
    + 'header button{opacity:0;background:#15585E;color:#fff;border:0}header.scrolled button{opacity:1}'
    + 'header button:focus-visible{outline:3px solid #1E6A71;outline-offset:2px}' // 1.3:1 on the scrolled header
    + 'section{height:900px}',
    '<header><input class="lt" aria-label="Light"><input class="dk" aria-label="Dark"><button type="button" class="rk">Call</button></header><section></section><section></section><section></section>'
    + '<script>addEventListener("scroll",()=>document.querySelector("header").classList.toggle("scrolled",scrollY>100));</script>'));
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element), ['input.dk']);
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element), ['button.rk']);
  assert.strictEqual(json.transparentControlsSkipped, 0);
  assert.strictEqual(code, 1);
});

test('controls mounted on scroll, a header animating on scroll and a hover state are measured once', async () => {
  const { code, json } = await run(fixture('mounted',
    'header{position:fixed;top:0;left:0;right:0;height:60px;display:flex;gap:16px;align-items:center;background:transparent}'
    + 'header.scrolled{animation:teal .4s both}@keyframes teal{from{background:transparent}to{background:#15585E}}'
    + 'header input{opacity:0;background:transparent;color:#fff;border:1px solid #fff}header.scrolled input{opacity:1}' // 8.11:1 once teal
    + 'header button{opacity:0;background:#fff;color:#000;border:1px solid #000}header.scrolled button{opacity:1}'
    + 'header button:hover{color:#aaa}' // 2.32:1, one failure
    + 'button.totop{position:fixed;bottom:16px;right:16px;background:#fff;color:#000;border:1px solid #000}'
    + 'button.totop:focus-visible{outline:2px solid #eee}' // 1.16:1
    + 'section{height:900px}', // the header turns teal at the first position, the button appears at the third
    '<header><input class="lt" aria-label="Search"><button type="button" class="hb">Menu</button></header><section></section><section></section><section></section>'
    + '<script>addEventListener("scroll",()=>{document.querySelector("header").classList.toggle("scrolled",scrollY>100);'
    + 'const b=document.querySelector(".totop");if(scrollY>1500&&!b){const n=document.createElement("button");n.className="totop";n.type="button";n.textContent="Top";document.body.append(n);}'
    + 'else if(scrollY<=1500&&b)b.remove();});</script>'));
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element), ['button.totop']);
  assert.deepStrictEqual(json.stateFailures.map((f) => `${f.state} ${f.element}`), ['hover button.hb']);
  assert.strictEqual(code, 1);
});

test('hidden-at-top, hover-only, scroll-driven and re-rendered controls are measured once each', async () => {
  const { code, json } = await run(fixture('round10',
    'button,a{background:#fff;color:#000;border:1px solid #000}'
    + 'button.td{display:none;position:fixed;bottom:16px;right:16px}button.td.show{display:inline-block}'
    + 'button.td:focus-visible{outline:2px solid #e8e8e8}' // 1.23:1, hidden by display at the top
    + '.reveal{opacity:0}.reveal.in{opacity:1}a.lnk:hover{color:#ddd}' // a link without href, hover 1.36:1
    + 'header{position:sticky;top:0;animation:tint linear both;animation-timeline:scroll();animation-range:0 300px}'
    + '@keyframes tint{from{background:#fff;color:#aaa}to{background:#15585E;color:#fff}}' // 2.32:1 at the top
    + 'a.rl{position:absolute;left:16px;color:#999}a.rl:hover{color:#ddd}' // a row rendered anew at each position, resting 2.85:1
    + 'section{height:900px}',
    '<header><p class="hd">Title</p></header><section></section><section></section>'
    + '<section class="reveal"><a class="lnk">Anchor</a></section><section></section>'
    + '<button type="button" class="td">Top</button>'
    + '<script>const r=document.querySelector(".reveal");new IntersectionObserver((es)=>es.forEach((e)=>r.classList.toggle("in",e.isIntersecting))).observe(r);'
    + 'addEventListener("scroll",()=>{document.querySelector(".td").classList.toggle("show",scrollY>300);'
    + 'document.querySelector(".rl")?.remove();if(scrollY>0){const a=document.createElement("a");a.href="#";a.className="rl";a.textContent="Row";a.style.top=(scrollY+100)+"px";document.body.append(a);}});</script>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element), ['button.td.show']);
  assert.deepStrictEqual(json.stateFailures.filter((f) => f.state === 'hover').map((f) => f.element).sort(), ['a.lnk', 'a.rl']);
  assert.ok(json.contrastFailures.some((f) => f.element === 'p.hd'), `the scroll-driven header must be measured at the top: ${JSON.stringify(json.contrastFailures)}`);
  assert.strictEqual(json.contrastFailures.filter((f) => f.element === 'a.rl').length, 1, `the re-rendered row is reported once: ${JSON.stringify(json.contrastFailures)}`);
  assert.strictEqual(code, 1);
});

test('the resting text of a control shown on scroll and a control hidden by visibility are measured', async () => {
  const { code, json } = await run(fixture('round11',
    'button{background:#fff;border:1px solid #000;position:fixed;bottom:16px}'
    + 'button.top{right:16px;color:#999;opacity:0;visibility:hidden}button.top.show{opacity:1;visibility:visible}' // resting 2.85:1
    + 'button.top:hover,button.top:focus{color:#000}'
    + 'button.vr{left:16px;color:#000;visibility:hidden}button.vr.show{visibility:visible}'
    + 'button.vr:focus-visible{outline:2px solid #eee}' // 1.16:1, hidden by visibility only at the top
    + 'section{height:900px}',
    '<section></section><section></section><button type="button" class="top">Top</button><button type="button" class="vr">Back</button>'
    + '<script>addEventListener("scroll",()=>document.querySelectorAll("button").forEach((b)=>b.classList.toggle("show",scrollY>300)));</script>'));
  assert.deepStrictEqual(json.contrastFailures.map((f) => f.element), ['button.top.show']);
  assert.deepStrictEqual(json.stateFailures, []);
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element), ['button.vr.show']);
  assert.strictEqual(code, 1);
});

test('text shown on scroll is measured in its own colour; an SVG title is not painted text', async () => {
  const { code, json } = await run(fixture('round12',
    'nav.mini{display:none;position:fixed;top:0;left:0;right:0;background:#15585E}nav.mini.on{display:block}'
    + 'nav.mini a{color:#555}nav.mini a:hover,nav.mini a:focus{color:#fff}' // 1.09:1 at rest, inside a display:none ancestor
    + 'button{position:fixed;bottom:16px;border:0;opacity:0}button.on{opacity:1}'
    + 'button.ic{right:16px;background:#2F99A4;color:#fff}' // icon only: the title is a name, not painted text
    + 'button.wr{left:16px;background:#fff;color:#bbb}button.wr span{color:#000}' // the painted label is #000
    + 'button.wc{left:120px;background:#fff;color:#000}button.wc span{color:#bbb}' // the painted label is 1.92:1
    + 'section{height:900px}',
    '<nav class="mini" aria-label="Mini"><a href="#a" class="mn">Home</a></nav><section></section><section></section>'
    + '<button type="button" class="ic"><svg width="16" height="16" aria-hidden="false"><title>Back to top</title><path d="M8 2l6 6H2z"/></svg></button>'
    + '<button type="button" class="wr"><span>Up</span></button><button type="button" class="wc"><span>Top</span></button>'
    + '<div data-contrast-demo><button type="button" class="dm" style="color:#ccc;background:#fff">Demo</button></div>'
    + '<script>addEventListener("scroll",()=>{document.querySelector("nav.mini").classList.toggle("on",scrollY>300);'
    + 'document.querySelectorAll("button").forEach((b)=>b.classList.toggle("on",scrollY>300));});</script>'));
  assert.deepStrictEqual(json.contrastFailures.map((f) => `${f.element} ${f.ratio}`).sort(), ['a.mn 1.09', 'span 1.92']);
  // The wrapped label fails at rest and is reported there, not again under hover and focus.
  assert.deepStrictEqual(json.stateFailures, []);
  assert.strictEqual(json.demoExemptElements, 1);
  assert.strictEqual(code, 1);
});

test('an element under the resting mouse position is measured at rest; text under a hidden ancestor is not', async () => {
  const { code, json } = await run(fixture('pointer',
    'body{margin:0}header{position:fixed;top:0;left:0;right:0;background:#fff}a.logo{color:#000}a.logo:hover{color:#ddd}main{padding-top:60px}',
    '<header><a class="logo" href="#">Logo</a></header><p>Text</p>'
    + '<div style="display:none"><p style="color:#eee">Never shown</p></div>')); // hidden by its ancestor: not painted
  assert.deepStrictEqual(json.contrastFailures, []);
  assert.deepStrictEqual(json.stateFailures.map((f) => `${f.state} ${f.element}`), ['hover a.logo']);
  assert.strictEqual(code, 1);
});

test('select, closed details, display: contents and an exit-intent page are measured as shown', async () => {
  const { code, json } = await run(fixture('round13',
    'select.sl{color:#bbb;background:#fff}' // 1.92:1, its text sits in closed <option>s
    + 'details p.dt{color:#bbb}' // inside a closed <details>
    + 'div.dc{display:contents;color:#bbb}' // no box of its own
    + 'a.card{color:#000}a.card span.m{color:#999}a.card:hover span.m{color:#aaa}' // descendant: 2.85 at rest, 2.32 hovered
    + 'main{outline:0}#exit{display:none}#exit.on{display:block;color:#ddd}', // an exit-intent popup must not open
    '<select class="sl" aria-label="Pick"><option>One</option></select>'
    + '<details><summary>More</summary><p class="dt">Answer</p></details>'
    + '<div class="dc">Contents</div>'
    + '<a class="card" href="#c">Title <span class="m">muted</span></a>'
    + '<div data-contrast-demo><p style="color:#eee">Specimen</p></div>'
    + '<p id="exit">Wait!</p>'
    + '<script>document.documentElement.addEventListener("mouseleave",()=>document.getElementById("exit").classList.add("on"));'
    + 'document.addEventListener("mouseout",(e)=>{if(!e.relatedTarget)document.getElementById("exit").classList.add("on")});'
    + 'document.querySelector("main").tabIndex=-1;</script>'));
  const text = json.contrastFailures.map((f) => f.element);
  for (const el of ['select.sl', 'p.dt', 'div.dc', 'span.m']) assert.ok(text.includes(el), `${el} must be measured at rest: ${JSON.stringify(text)}`);
  assert.ok(!text.includes('option'), `the shown option is reported once, on the select: ${JSON.stringify(text)}`);
  assert.ok(!json.contrastFailures.some((f) => f.text === 'Wait!'), `the exit-intent popup must stay closed: ${JSON.stringify(text)}`);
  assert.deepStrictEqual(json.stateFailures.filter((f) => f.element.startsWith('a.card')).map((f) => `${f.state} ${f.element}`).sort(), ['hover a.card span.m']);
  assert.ok(!json.stateFailures.some((f) => f.element.startsWith('main')), `a demo inside the focusable <main> is exempt: ${JSON.stringify(json.stateFailures)}`);
  assert.strictEqual(code, 1);
});

test('per-element state keys, the shown select value, a JS hover at the origin, contents backgrounds and SVG classes', async () => {
  const { code, json } = await run(fixture('round14',
    'body{margin:0}a.logo{position:absolute;top:0;left:0;color:#000}a.logo.hot{color:#ccc}' // hover state set by script at (0, 0)
    + 'footer a{color:#999}nav a:hover{color:#999}' // same tag, colour and surface, two elements
    + 'select.s{color:#bbb;background:#fff}select.s option{color:#000}' // the closed box paints #bbb
    + 'section.dk{background:#000;color:#fff}div.dc{display:contents;background:#fff}' // the white is never painted
    + 'svg text.a,svg text.b{color:#ddd}main{padding-top:40px}', // the audit compares color; the key must keep the classes apart
    '<a class="logo" href="#l">Logo</a><nav aria-label="Main"><a href="#h">Home</a></nav>'
    + '<select class="s" aria-label="Pick"><option>Choose one</option></select>'
    + '<section class="dk"><div class="dc">Painted on black</div></section>'
    + '<svg width="200" height="40" aria-hidden="true"><text class="a" x="0" y="15" fill="#ddd">One</text><text class="b" x="0" y="35" fill="#ddd">Two</text></svg>'
    + '<footer><a href="#i">Imprint</a></footer>'
    + '<script>const l=document.querySelector(".logo");l.addEventListener("mouseenter",()=>l.classList.add("hot"));l.addEventListener("mouseleave",()=>l.classList.remove("hot"));</script>'));
  const text = json.contrastFailures.map((f) => `${f.element} ${f.text}`);
  assert.ok(!text.some((t) => t.startsWith('a.logo')), `the logo is measured at rest, not in its scripted hover: ${JSON.stringify(text)}`);
  assert.ok(!text.some((t) => t.startsWith('div.dc')), `display: contents paints no background: ${JSON.stringify(text)}`);
  assert.ok(text.includes('select.s Choose one'), `the closed select shows its value in its own colour: ${JSON.stringify(text)}`);
  assert.ok(text.includes('text.a One') && text.includes('text.b Two'), `two SVG classes are two entries: ${JSON.stringify(text)}`);
  assert.ok(json.stateFailures.some((f) => f.state === 'hover' && f.text === 'Home'), `the nav link's hover is not hidden by the footer link: ${JSON.stringify(json.stateFailures)}`);
  assert.strictEqual(code, 1);
});

test('an exit-intent listener on <html>, select names and a select without a value', async () => {
  const { code, json } = await run(fixture('round15',
    'body{margin:0}header{height:40px;background:#fff}#pop{display:none}#pop.on{display:block;color:#ddd}'
    + 'select.h{color:#000;background:#fff}select.h:hover{color:#bbb}' // hover 1.92:1, on the select
    + 'select.n{color:#bbb;background:#fff}' // no option selected: the options themselves are measured
    + 'a.t{color:#000}a.t:hover{color:#bbb}' // the link and its span tie under hover: the link keeps the report
    + '#gone{display:none}#gone.on{display:block;color:#ddd}',
    '<header>Header</header>'
    + '<select class="h" aria-label="Hovered"><option>\n      Choose one\n    </option><option>Second</option></select>'
    + '<select class="n" aria-label="Empty"><option>First</option></select><p id="pop">Exit popup</p>'
    + '<a class="t" href="#t">Go <span>far</span></a><p id="gone">Removed listener ran</p>'
    + '<script>document.querySelector("select.n").selectedIndex=-1;'
    + 'const show=(e)=>{if(!e.relatedTarget)document.getElementById("pop").classList.add("on")};'
    + 'document.documentElement.addEventListener("mouseout",show);document.body.addEventListener("pointerout",show);'
    + 'document.documentElement.addEventListener("pointerout",show);document.documentElement.removeEventListener("pointerout",show);'
    + 'const gone=()=>document.getElementById("gone").classList.add("on");'
    + 'document.documentElement.addEventListener("mouseout",gone);document.documentElement.removeEventListener("mouseout",gone);'
    + 'document.documentElement.dispatchEvent(new MouseEvent("mouseout",{relatedTarget:document.body}));</script>'));
  assert.ok(!json.contrastFailures.some((f) => f.text === 'Exit popup'), `the exit-intent popup must stay closed: ${JSON.stringify(json.contrastFailures)}`);
  assert.deepStrictEqual(json.stateFailures.filter((f) => f.state === 'hover').map((f) => `${f.element}|${f.text}`).sort(), ['a.t|Go', 'select.h|Choose one']);
  assert.ok(!json.contrastFailures.some((f) => f.text === 'Removed listener ran'), `a removed listener must not run: ${JSON.stringify(json.contrastFailures)}`);
  assert.deepStrictEqual(json.contrastFailures.map((f) => `${f.element}|${f.text}`), ['option|First']);
  assert.strictEqual(code, 1);
});

test('a hover-out delegated from <body> releases; handler properties and listener objects stay shut', async () => {
  const { code, json } = await run(fixture('round16',
    'body{margin:0}a.logo{position:absolute;top:0;left:0;color:#000}a.logo.hot{color:#ccc}' // scripted hover at (0, 0)
    + '.pop{display:none}.pop.on{display:block;color:#ddd}main{padding-top:40px}',
    '<a class="logo" href="#l">Logo</a><p class="pop" id="p1">Popup one</p><p class="pop" id="p2">Popup two</p>'
    + '<script>const l=document.querySelector(".logo");'
    + 'document.body.addEventListener("mouseover",(e)=>{if(e.target===l)l.classList.add("hot")});'
    + 'document.body.addEventListener("mouseout",(e)=>{if(e.target===l)l.classList.remove("hot")});'
    + 'document.body.onmouseout=(e)=>{if(!e.relatedTarget)document.getElementById("p1").classList.add("on")};'
    + 'document.documentElement.addEventListener("mouseout",{handleEvent(e){if(!e.relatedTarget)document.getElementById("p2").classList.add("on")}});</script>'));
  const text = json.contrastFailures.map((f) => f.text);
  assert.ok(!text.includes('Logo'), `the delegated hover-out releases the logo: ${JSON.stringify(text)}`);
  assert.ok(!text.includes('Popup one') && !text.includes('Popup two'), `handler property and listener object stay shut: ${JSON.stringify(text)}`);
  assert.deepStrictEqual(json.contrastFailures, []);
  assert.strictEqual(code, 0);
});

test('a skipped leave reaches only its own listener, with <body> as related target', async () => {
  const { code, json } = await run(fixture('round17',
    'body{margin:0}a.logo{position:absolute;top:0;left:0;color:#000}a.logo.hot{color:#ccc}'
    + 'a.logo.ph{color:#ccc}' // a pointer hover delegated from <html> that only counts the mouse
    + '.pop{display:none}.pop.on{display:block;color:#ddd}main{padding-top:40px}',
    '<a class="logo" href="#l">Logo</a><p class="pop" id="p1">Popup one</p><p class="pop" id="p2">Popup two</p>'
    + '<script>const l=document.querySelector(".logo");'
    // A toggle on the element itself, plus a harmless listener on <body> so a leave is skipped there.
    + 'l.addEventListener("mouseover",()=>l.classList.toggle("hot"));l.addEventListener("mouseout",()=>l.classList.toggle("hot"));'
    + 'document.body.addEventListener("mouseout",()=>{});'
    + 'document.documentElement.addEventListener("pointerover",(e)=>{if(e.target===l&&e.pointerType==="mouse")l.classList.add("ph")});'
    + 'document.documentElement.addEventListener("pointerout",(e)=>{if(e.pointerType!=="mouse")return;if(e.target===l)l.classList.remove("ph")});'
    // The widely copied exit-intent check treats a relatedTarget of <html> as leaving the window.
    + 'document.body.addEventListener("mouseout",(e)=>{const f=e.relatedTarget||e.toElement;if(!f||f.nodeName==="HTML")document.getElementById("p1").classList.add("on")});'
    // A listener object that gets its handleEvent only after it is added.
    + 'const o={};document.documentElement.addEventListener("mouseout",o);o.handleEvent=(e)=>{if(!e.relatedTarget)document.getElementById("p2").classList.add("on")};</script>'));
  assert.deepStrictEqual(json.contrastFailures, []);
  assert.strictEqual(code, 0);
});

test('a replayed leave keeps the path and phase it had and a related target in the document', async () => {
  const { code, json } = await run(fixture('round18',
    'body{margin:0}a.logo{position:absolute;top:0;left:0;color:#000}a.logo.hot,a.logo.ph{color:#ccc}'
    + '.pop{display:none}.pop.on{display:block;color:#ddd}main{padding-top:40px}',
    '<a class="logo" href="#l">Logo</a><p class="pop" id="p1">Popup one</p>'
    + '<script>const l=document.querySelector(".logo");'
    + 'document.body.addEventListener("mouseover",(e)=>{if(e.composedPath().includes(l))l.classList.add("hot")});'
    + 'document.body.addEventListener("mouseout",(e)=>{if(e.composedPath().includes(l))l.classList.remove("hot")});'
    + 'document.body.addEventListener("mouseover",(e)=>{if(e.target===l)l.classList.add("ph")});'
    + 'document.body.addEventListener("mouseout",(e)=>{if(e.eventPhase!==Event.BUBBLING_PHASE)return;if(e.target===l)l.classList.remove("ph")});'
    + 'document.body.addEventListener("mouseout",(e)=>{if(!document.documentElement.contains(e.relatedTarget))document.getElementById("p1").classList.add("on")});</script>'));
  assert.deepStrictEqual(json.contrastFailures, []);
  assert.strictEqual(code, 0);
});

test('a hover-out that runs after a delay is waited for', async () => {
  const { code, json } = await run(fixture('round19',
    'body{margin:0}a.logo{position:absolute;top:0;left:0;color:#000}a.logo.hot,a.logo.dg{color:#ccc}main{padding-top:40px}',
    '<a class="logo" href="#l">Logo</a>'
    + '<script>const l=document.querySelector(".logo");l.addEventListener("mouseover",()=>l.classList.add("hot"));'
    + 'const later=setTimeout;' // a library's own reference to setTimeout, as debounce helpers keep
    + 'l.addEventListener("mouseout",()=>later(()=>l.classList.remove("hot"),300));' // hover intent on the element
    // the same, delegated from <body>: its leave is skipped and replayed, and its timer waited for too
    + 'document.body.addEventListener("mouseover",(e)=>{if(e.target===l)l.classList.add("dg")});'
    + 'document.body.addEventListener("mouseout",(e)=>{if(e.target===l)later(()=>l.classList.remove("dg"),900)});</script>'));
  assert.deepStrictEqual(json.contrastFailures, []);
  assert.strictEqual(code, 0);
});

test('the settle wait does not depend on the page\'s own setTimeout', async () => {
  // A page that replaces setTimeout with a stub that never fires must not hang the run (the
  // helper kills a hung audit, so a hang fails this test).
  const { code, json } = await run(fixture('stubtimer',
    'p.weak{color:#aaa}',
    '<p class="weak">Weak</p><script>window.setTimeout=()=>0;</script>'));
  assert.deepStrictEqual(json.contrastFailures.map((f) => f.element), ['p.weak']);
  assert.strictEqual(code, 1);
});

test('string timer handlers run; chained timers and intervals of a hover-out are waited for', async () => {
  const { code, json } = await run(fixture('round21',
    'body{margin:0}a.logo{position:absolute;top:0;left:0;color:#000}a.logo.c1,a.logo.c2{color:#ccc}'
    + 'p.weak{display:none;color:#aaa}p.weak.on{display:block}main{padding-top:40px}',
    '<a class="logo" href="#l">Logo</a><p class="weak">Revealed</p>'
    + '<script>setTimeout("document.querySelector(\'p.weak\').classList.add(\'on\')",50);' // a legacy string handler
    + 'const l=document.querySelector(".logo");l.addEventListener("mouseover",()=>{l.classList.add("c1");l.classList.add("c2")});'
    + 'l.addEventListener("mouseout",()=>setTimeout(()=>setTimeout(()=>l.classList.remove("c1"),300),100));' // a chain
    + 'l.addEventListener("mouseout",()=>{let n=0;const i=setInterval(()=>{if(++n===6){clearInterval(i);setTimeout(()=>l.classList.remove("c2"),400)}},50)});</script>')); // a poll whose last tick sets a timer, outlasting the chain
  assert.deepStrictEqual(json.contrastFailures.map((f) => f.element), ['p.weak.on']);
  assert.strictEqual(code, 1);
});

for (const [name, out] of [
  ['timer', 'setTimeout(()=>setTimeout(rm,600),100)'], // a timer set in a timer
  ['string', 'window.rm=rm;window.later=()=>setTimeout(rm,600);setTimeout("later()",100)'], // a legacy string handler that sets the next timer
  ['await', 'setTimeout(async()=>{await null;await null;setTimeout(rm,600)},100)'], // two awaits before the next timer
  ['a cleared string timer', 'clearTimeout(setTimeout("void 0",50));setTimeout(()=>setTimeout(rm,600),100)'], // a string timeout cleared before it runs opens no window to close
]) {
  test(`a hover-out chained through ${name} is waited for, on its own`, async () => {
    const { code, json } = await run(fixture(`chain-${name}`,
      'body{margin:0}a.logo{position:absolute;top:0;left:0;color:#000}a.logo.h{color:#ccc}main{padding-top:40px}',
      '<a class="logo" href="#l">Logo</a><script>const l=document.querySelector(".logo");const rm=()=>l.classList.remove("h");'
      + `l.addEventListener("mouseover",()=>l.classList.add("h"));l.addEventListener("mouseout",()=>{${out}});</script>`));
    assert.deepStrictEqual(json.contrastFailures, []);
    assert.strictEqual(code, 0);
  });
}

test('only keyboard-reachable controls are judged as focus indicators', async () => {
  const { code, json } = await run(fixture('reach',
    'button{background:#fff;border:1px solid #000;color:#000}:focus-visible{outline:2px solid #ddd}', // 1.36:1
    '<button type="button" class="ok">Judged</button>'
    + '<div aria-hidden="true"><a href="#x" tabindex="-1" class="dup">Duplicate</a></div>'
    + '<div role="region" aria-label="Target" tabindex="-1" class="lm">Target</div>'
    + '<div inert><button type="button" class="inert">Inert</button></div>'
    + '<input class="tr" style="opacity:0" aria-label="Transparent">'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element), ['button.ok']);
  assert.strictEqual(json.transparentControlsSkipped, 1);
  assert.strictEqual(code, 1);
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

test('rings and boundaries are measured as painted: an author auto ring, a blur, opacity, an inset ring', async () => {
  const { code, json } = await run(fixture('painted',
    'button{color:#000;background:#fff;border:1px solid #000}'
    + 'button.au:focus-visible{outline:4px auto #eee}' // an auto ring in the author's colour, 1.16:1
    + 'button.bl:focus-visible{outline:none;box-shadow:0 0 8px 1px #767676}' // 4.54:1 solid, about 2.1:1 as painted
    + 'button.sh:focus-visible{outline:none;box-shadow:0 0 0 2px #767676}' // the same ring unblurred passes
    + 'button.tr{background:#000;color:#fff}button.tr:focus-visible{outline:2px solid rgba(255,255,255,.5)}' // over the page, not the button: 1:1
    + '.faded{opacity:.15}button.ob:focus-visible{outline:2px solid #000}input.op{border:1px solid #000;background:#fff}'
    + 'input.rg,input.wk{border:0;background:#fff;box-shadow:inset 0 0 0 1px #6b7280}input.wk{box-shadow:inset 0 0 0 1px #ddd}',
    '<button type="button" class="au">Auto</button><button type="button" class="ua">Browser</button>'
    + '<button type="button" class="bl">Blur</button><button type="button" class="sh">Sharp</button><button type="button" class="tr">Dark</button>'
    + '<div class="faded"><button type="button" class="ob">Faded</button><label>Faded <input class="op"></label></div>'
    + '<label>Ring <input class="rg"></label><label>Weak ring <input class="wk"></label>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => `${f.element} ${f.indicator}`).sort(),
    ['button.au outline', 'button.bl box-shadow', 'button.ob outline', 'button.tr outline']);
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element).sort(), ['input.op', 'input.wk']);
  assert.strictEqual(json.focusUserAgentRing, 4, 'the browser ring of button.ua and the three inputs, not the author auto ring');
  assert.strictEqual(code, 1);
});

test('a page that stubs requestAnimationFrame is still measured, also at a scroll position', async () => {
  const { code, json } = await run(fixture('stubraf', 'p.weak{color:#aaa}.tall{height:3000px}button.top{opacity:0}button.top.on{opacity:1}',
    '<p class="weak">Weak</p><div class="tall"></div><button type="button" class="top">Top</button>' // shown only once scrolled
    + '<script>const t=document.querySelector(".top");addEventListener("scroll",()=>t.classList.toggle("on",scrollY>100));'
    + 'window.requestAnimationFrame=()=>0;</script>'));
  assert.deepStrictEqual(json.contrastFailures.map((f) => f.element), ['p.weak']);
  assert.strictEqual(json.transparentControlsSkipped, 0, 'button.top is measured where it was visible');
  assert.strictEqual(code, 1);
});

test('a page that re-renders its list on a child mutation still has every ring measured', async () => {
  const { code, json } = await run(fixture('rerender', 'button{color:#000;background:#fff;border:1px solid #000}button.weak:focus-visible{outline:2px solid #eee}',
    '<div id="list"><button type="button" class="ua">Default</button><button type="button" class="weak">Weak</button></div>'
    + '<script>const l=document.getElementById("list");const mo=new MutationObserver(()=>{mo.disconnect();'
    + 'l.replaceChildren(...[...l.children].map((c)=>c.cloneNode(true)));mo.observe(l,{childList:true});});mo.observe(l,{childList:true});</script>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element), ['button.weak']);
  assert.strictEqual(code, 1);
});

test('the browser ring of a control with its own color-scheme is the browser ring', async () => {
  for (const scheme of ['light', 'dark']) {
    const { json } = await run(fixture(`ownscheme${scheme}`, ':root{color-scheme:light dark}@media (prefers-color-scheme:dark){body{background:#111;color:#eee}}'
      + 'button{color:inherit;background:transparent;border:1px solid currentColor}.d{color-scheme:dark}.l{color-scheme:light}',
      '<button type="button" class="d">Dark</button><button type="button" class="l">Light</button>'), '--scheme', scheme);
    assert.deepStrictEqual(json.focusRingFailures, [], scheme);
    assert.strictEqual(json.focusUserAgentRing, 2, scheme);
  }
});

test('the browser ring follows the used color-scheme: none declared, or a meta tag only', async () => {
  // No color-scheme anywhere: the used scheme is light, also when the run emulates dark.
  const none = await run(fixture('noscheme', '', '<button type="button">Plain</button>'), '--scheme', 'dark');
  assert.deepStrictEqual(none.json.focusRingFailures, []);
  assert.strictEqual(none.json.focusUserAgentRing, 1, 'the light ring of a page without color-scheme');
  // Declared only by <meta name="color-scheme">, read as Chromium reads it: name and
  // keywords case-insensitive, a comma list invalid (light).
  for (const [i, [name, content, scheme]] of [['color-scheme', 'dark', 'light'], ['Color-Scheme', 'Dark', 'light'], ['color-scheme', 'light, dark', 'dark']].entries()) {
    const page = path.join(dir, `metascheme${i}.html`);
    fs.writeFileSync(page, `<!doctype html><html lang="en"><head><meta name="${name}" content="${content}"><title>metascheme</title>`
      + '<style>body{background:#fff;color:#000}</style></head><body><main><button type="button">Meta</button></main></body></html>');
    const meta = await run(page, '--scheme', scheme);
    assert.deepStrictEqual(meta.json.focusRingFailures, [], content);
    assert.strictEqual(meta.json.focusUserAgentRing, 1, `the browser ring the meta tag "${content}" selects`);
  }
});

test('a blurred ring is judged by the darkest pixel the page paints', async () => {
  const { code, json } = await run(fixture('blurpx', 'button{color:#000;background:#fff;border:1px solid #000}'
    + 'button.bl:focus-visible{outline:none;box-shadow:0 0 4px 1px #646464}' // 3.04 at the edge, 2.55 painted
    + 'input.rg{border:0;background:#fff;box-shadow:inset 0 0 4px 1px #4c4c4c}', // 2.92 painted
    '<button type="button" class="bl">Blur</button><label>Ring <input class="rg"></label>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element), ['button.bl']);
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element), ['input.rg']);
  assert.strictEqual(code, 1);
});

// Shapes a page author meets: each of these must fail, and the class names which.
test('weak indicators in their common shapes fail', async () => {
  const { code, json } = await run(fixture('weakshapes',
    `button{color:#000;background:#fff;border:1px solid #000}
    a.fo:focus{outline:2px solid #eee}/* written under :focus, not :focus-visible */
    button.tf:focus-visible{outline:none;box-shadow:rgba(0,0,0,0) 0 0 0 0,#eee 0 0 0 3px}/* transparent first layer */
    button.ot:focus-visible{outline:2px solid transparent;box-shadow:0 0 0 3px #eee}/* transparent outline, shadow ring */
    a.tr:focus-visible{outline:3px solid rgba(0,0,0,.2);outline-offset:2px}/* translucent: renders #ccc, 1.6:1 */
    a.ok:focus-visible{outline:3px solid oklch(0.95 0 0)}/* a non-rgb colour */
    .grey{background:#ccc;padding:8px}input.tb{border:2px solid rgba(0,0,0,.5);background:#fff}/* border over the white fill: 2.5:1 on #ccc */
    input.af{border:1px solid #000}input.af:focus-visible{outline:2px solid #eee}/* focused on load (autofocus) */
    a.fl{display:inline}a.fl:focus-visible{outline:2px solid #eee}/* only floated content: a 0x0 box */
    button.bc:focus-visible{outline:none;border-color:#eee}/* focus shown by the border alone */
    button.tb2{border:2px solid #000}button.tb2:focus-visible{outline:none;border-color:rgba(0,0,0,.5)}/* over the white fill: 2.5:1 on #ccc */
    a.off{outline:2px solid #e8e8e8}a.off:focus-visible{outline-offset:4px}/* a weak outline that only moves out */
    button.boff{outline:2px solid #eee;outline-offset:-8px}button.boff:focus-visible{outline-offset:2px}/* moved from inside to outside */`,
    `<p><a class="fo" href="#a">One</a> <a class="tr" href="#b">Two</a> <a class="ok" href="#c">Three</a></p>\
<button type="button" class="tf">Go</button> <button type="button" class="ot">Go</button>\
<div class="grey"><label>Name <input class="tb"></label> <button type="button" class="tb2">Go</button></div>\
<label>Search <input class="af" autofocus></label> <button type="button" class="bc">Go</button>\
<p><a class="fl" href="#f"><span style="float:left">Floated</span></a></p>\
<p><a class="off" href="#o">Moves</a> <button type="button" class="boff">Moves</button></p>`));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element).sort(),
    ['a.fl', 'a.fo', 'a.off', 'a.ok', 'a.tr', 'button.bc', 'button.boff', 'button.ot', 'button.tb2', 'button.tf', 'input.af']);
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element), ['input.tb']);
  assert.strictEqual(code, 1);
});

// Each of these passes, or is not a focus state a user can reach.
test('strong, unchanged, unreachable and hidden indicators do not fail', async () => {
  const { code, json } = await run(fixture('fineshapes',
    `button{color:#fff;background:#444;border:0}
    a.tw:focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px #1d4ed8}/* ring offset: white, then a blue ring */
    .dark{background:#222;padding:8px}
    button.inset{box-shadow:inset 0 1px 2px rgba(0,0,0,.1)}button.inset:focus-visible{box-shadow:inset 0 1px 2px rgba(0,0,0,.1),0 0 0 3px #fff}
    a.decor{box-shadow:0 1px 2px rgba(0,0,0,.08)}a.decor:focus-visible{outline:none;text-decoration-thickness:3px}/* permanent shadow is no ring */
    button.ir{background:#222}button.ir:focus-visible{outline:2px solid #fff;outline-offset:-4px}/* inset outline: white on #222 */
    button.dis:focus-visible{outline:2px solid #eee}
    .mid{background:#595959;padding:8px}input.fill{border:0;background:#fff}/* no border, the fill carries the boundary */
    input.faint{border:1px solid #eee;background:#fff}
    a.perm{outline:1px solid #eee}/* a permanent outline is not a focus indicator */
    a.pr{box-shadow:0 0 0 3px #eee}a.pr:focus-visible{outline:none;text-decoration-thickness:3px}/* nor a permanent ring */
    button.ins{background:#222}button.ins:focus-visible{outline:none;box-shadow:inset 0 0 0 3px #fff}/* inset ring: white on #222 */
    button.gl:focus-visible{outline:none;box-shadow:0 0 8px #eee}/* a blur glow without spread is no ring */
    /* a custom switch: a transparent input over a track its parent draws */
    .sw{position:relative;display:inline-block;width:40px;height:20px;background:#15585E;border-radius:10px}
    /* (transparent and borderless, its "fill" is the track itself: 1.00:1 if it were judged) */
    .sw input{appearance:none;position:absolute;inset:0;margin:0;opacity:0;background:transparent;border:0}
    /* the usual visually hidden input: its white fill alone is 1.00:1 on white */
    input.sr{position:absolute;width:1px;height:1px;padding:0;border:0;background:#fff;overflow:hidden;clip-path:inset(50%)}`,
    `<p><a class="tw" href="#a">Ring</a> <a class="decor" href="#b">Card link</a></p>\
<div class="dark"><button type="button" class="inset">Go</button></div>\
<button type="button" class="ir">Inset</button> <button type="button" class="dis" disabled>Off</button>\
<div class="mid"><label style="color:#fff">Name <input class="fill"></label></div>\
<div style="display:none"><input class="faint"></div><dialog><input class="faint"></dialog>\
<div style="visibility:hidden"><input class="faint"></div><fieldset disabled><input class="faint"></fieldset>\
<p><a class="perm" href="#p">Outlined</a> <a class="pr" href="#q">Ringed</a> <button type="button" class="ins">Inset</button></p>\
<label>Hidden <input class="sr"></label>\
<p><button type="button" class="gl">Glow</button> <label>Notify <span class="sw"><input type="checkbox"></span></label></p>`));
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.ok(json.focusWithoutRing >= 1, `the card link shows focus without a ring and must be counted, got ${json.focusWithoutRing}`);
  assert.strictEqual(code, 0, `expected a pass, got exit ${code}`);
});

// Each of these passes the colour model and fails as Chromium paints it; one block each,
// far apart, so no clip around one control reaches another one's ring.
test('rings and boundaries the colour model passes fail on their painted pixels', async () => {
  const { code, json } = await run(fixture('pixels',
    'body{margin:0}div.b{margin:80px 100px}'
    + 'button{color:#000;background:#fff;border:1px solid #000;font:16px sans-serif;padding:0;width:120px;height:30px;box-sizing:border-box}'
    + 'button.fs:focus-visible{outline:none;box-shadow:0 0 2px 0.25px #000}' // fractional spread: about 2.1:1 painted
    + 'button.wb{width:40px;height:24px}button.wb:focus-visible{outline:none;box-shadow:0 0 32px 2px #282828}' // blur wide against the control
    + 'button.hl:focus-visible{outline:none;box-shadow:0 0 0 3px #eee,0 0 0 2px #000}' // the black layer lies under the #eee one
    + 'button.ho:focus-visible{outline:3px solid #eee;box-shadow:0 0 0 2px #000}' // the black ring lies under the outline
    + '.card{overflow:hidden;width:120px;height:30px}button.cl{display:block}button.cl:focus-visible{outline:3px solid #000}' // clipped
    // clipped too; its icon recolours and its label gains an underline: text and icons are no indicator
    + 'button.tx{display:block}button.tx:focus-visible{outline:3px solid #000;color:#15585E;text-decoration:underline 3px}'
    + 'button.tx svg{vertical-align:middle}'
    + '.fo{filter:opacity(.15)}button.fo:focus-visible{outline:2px solid #000}' // filter
    + '.mb{mix-blend-mode:difference}button.mb:focus-visible{outline:2px solid #000}' // difference on white: white
    + 'button.pill{width:140px;height:32px;border-radius:999px}button.pill:focus-visible{outline:none;box-shadow:0 0 4px 1px #4c4c4c}' // the same ring passes on a rectangle
    + 'input.gr{border:0;width:200px;height:30px;background:#000 linear-gradient(#fff,#fff)}' // the model reads the #000 under the white gradient
    // a permanent outline Chromium's focus style moves by 1px; the new ring is clipped under it.
    // The move is pinned for the screenshots, so it does not pass as the indicator.
    + '.pclip{display:inline-block;overflow:hidden;padding:2px}a.p{display:inline-block;outline:2px solid #000;color:#000}a.p:focus-visible{box-shadow:0 0 0 3px #767676}',
    ['fs', 'wb', 'hl', 'ho'].map((c) => `<div class="b"><button type="button" class="${c}">Go</button></div>`).join('')
    + '<div class="b"><div class="card"><button type="button" class="cl">Go</button></div></div>'
    + '<div class="b"><div class="card"><button type="button" class="tx"><svg width="18" height="18" aria-hidden="true"><rect width="18" height="18" fill="currentColor"/></svg> Clipped ring</button></div></div>'
    + '<div class="b fo"><button type="button" class="fo">Go</button></div><div class="b mb"><button type="button" class="mb">Go</button></div>'
    + '<div class="b"><button type="button" class="pill">Go</button></div><div class="b"><input class="gr" aria-label="Name"></div>'
    + '<div class="b"><div class="pclip"><a class="p" href="#x">Link</a></div></div>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy}`).sort(),
    ['a.p', 'button.cl', 'button.fo', 'button.fs', 'button.hl', 'button.ho', 'button.mb', 'button.pill', 'button.tx', 'button.wb'].map((e) => `${e} pixels`));
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => `${f.element} ${f.measuredBy}`), ['input.gr pixels']);
  for (const f of [...json.focusRingFailures, ...json.controlBoundaryFailures]) {
    assert.ok(typeof f.color === 'string' || typeof f.border === 'string', `a colour is named: ${JSON.stringify(f)}`);
    assert.strictEqual(typeof f.against, 'string', JSON.stringify(f));
  }
  // A ring failure names the pixel its ratio comes from: the two colours give that ratio.
  for (const f of json.focusRingFailures) assert.ok(Math.abs(contrastOf(f.color, f.against) - f.ratio) < 0.06, JSON.stringify(f));
  assert.strictEqual(json.focusRingUnverified, 0);
  assert.strictEqual(code, 1);
});

test('a control another element covers is counted as unverified, not failed', async () => {
  const { code, json } = await run(fixture('covered',
    'body{margin:0}.cover{position:fixed;top:0;height:200px;width:300px;background:#15585E;z-index:10}.c1{left:0}.c2{left:400px;pointer-events:none}'
    + '.c3{left:800px;background:rgba(21,88,94,.9)}' // translucent: the ring still changes pixels under it
    + 'button{position:absolute;top:100px;color:#000;background:#fff;border:1px solid #000;width:120px;height:30px}'
    + 'button:focus-visible{outline:2px solid #000;outline-offset:2px}button.u1{left:100px}button.u2{left:500px}button.u3{left:900px}' // 21:1 on the page, hidden as painted
    + 'input{position:absolute;top:150px;left:100px;border:1px solid #000;background:#fff}',
    '<div class="cover c1"></div><div class="cover c2"></div><div class="cover c3"></div>'
    + '<button type="button" class="u1">Under</button><button type="button" class="u2">Under pointer-events: none</button>'
    + '<button type="button" class="u3">Under a translucent cover</button><input aria-label="Under">'));
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.strictEqual(json.focusRingUnverified, 3, 'the headers cover all three buttons; the hit test sees the second only with pointer-events forced on');
  assert.strictEqual(json.controlBoundaryUnverified, 1);
  assert.strictEqual(code, 0);
});

test('strong rings and boundaries still pass on their pixels', async () => {
  const { code, json } = await run(fixture('pxstrong',
    `button{color:#000;background:#fff;border:1px solid #000;margin:16px}
    button.ol:focus-visible{outline:2px solid #000;outline-offset:2px}
    button.sr:focus-visible{outline:none;box-shadow:0 0 0 3px #585961}
    button.bc{border:2px solid #000}button.bc:focus-visible{outline:none;border-color:#767676}
    input.bd{border:1px solid #767676;background:#fff}
    input[type=checkbox]:focus-visible{outline:2px solid #000;outline-offset:2px}
    .col{width:150px}a.wr{color:#000}a.wr:focus-visible{outline:2px solid #000;outline-offset:1px}`,
    `<button type="button" class="ol">Outline</button><button type="button" class="sr">Ring</button><button type="button" class="bc">Border</button>\
<label>Name <input class="bd"></label> <input type="checkbox" aria-label="Box">\
<p class="col">Read the <a href="#x" class="wr">longer link text that wraps</a> here.</p>\
<!-- below the fold: scrolled into view for the screenshots, so neither is unverified -->\
<div style="height:2400px"></div><button type="button" class="ol">Below</button><input class="bd" aria-label="Below">`));
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.strictEqual(json.focusRingUnverified, 0);
  assert.strictEqual(json.controlBoundaryUnverified, 0);
  assert.strictEqual(code, 0, `expected a pass, got exit ${code}`);
});

const WEAK = 'box-shadow:0 0 2px 0.25px #000'; // a fractional-spread ring the model passes, about 2.1:1 painted

test('a recoloured CSS icon or a transparent overlay does not hide a weak ring', async () => {
  // A 20x20 square that turns black on focus is compact: it holds many changed pixels but no
  // length along the control, so it cannot carry the ring.
  const icon = await run(fixture('cssicon',
    'body{margin:0}div.b{margin:80px 100px}button{color:#000;background:#fff;border:1px solid #000;padding:0;width:120px;height:30px;box-sizing:border-box;position:relative}'
    + 'button.ci::before{content:"";position:absolute;left:4px;top:4px;width:20px;height:20px;background:#ddd}button.ci:focus-visible::before{background:#000}'
    + 'button .sq{display:inline-block;width:20px;height:20px;background:#ddd;vertical-align:middle}button.sp:focus-visible .sq{background:#000}'
    + `button:focus-visible{outline:none;${WEAK}}`,
    '<div class="b"><button type="button" class="ci">Go</button></div><div class="b"><button type="button" class="sp"><span class="sq"></span> Go</button></div>'));
  assert.deepStrictEqual(icon.json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy}`), ['button.ci pixels', 'button.sp pixels']);
  // An element over the control that paints nothing (a stretched-link overlay) covers nothing.
  const overlay = await run(fixture('overlay',
    'body{margin:0}.card{position:relative;margin:80px 100px;width:300px;padding:20px;border:1px solid #000}.card .ov{position:absolute;inset:0;background:transparent}'
    + `button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px}button:focus-visible{outline:none;${WEAK}}`,
    '<div class="card"><button type="button" class="ub">Go</button><div class="ov"></div></div>'));
  assert.deepStrictEqual(overlay.json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy}`), ['button.ub pixels']);
  assert.strictEqual(overlay.json.focusRingUnverified, 0);
});

test('a control inside a scroll container is measured where focus scrolls it into view', async () => {
  const { code, json } = await run(fixture('scrollbox',
    // Away from the window's edges, so only the panel's clip can bring them into view.
    '.sc{height:120px;overflow:auto;border:1px solid #000;width:300px;margin:40px 100px}.pad{height:400px}button{color:#000;background:#fff;border:1px solid #000}'
    + 'button:focus-visible,.tr a:focus-visible{outline:2px solid #000;outline-offset:2px}input{border:1px solid #000;background:#fff}'
    + '.tr{display:flex;gap:16px;overflow-x:auto;width:400px;padding:8px;margin:40px 100px}.tr a{flex:0 0 150px;color:#000;padding:4px}',
    '<div class="sc"><p>Panel</p><div class="pad"></div><button type="button" class="in">Inside</button> <input aria-label="Inside"></div>'
    + '<div class="tr">' + [1, 2, 3, 4, 5, 6].map((i) => `<a href="#s${i}" class="s${i}">Slide ${i}</a>`).join('') + '</div>'));
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.strictEqual(json.focusRingUnverified, 0);
  assert.strictEqual(json.controlBoundaryUnverified, 0);
  assert.strictEqual(code, 0);
});

test('a ring around an icon or an image is measured with the icon hidden, not cut out, and a recoloured image carries no ring', async () => {
  const img = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2260%22%3E%3Crect width=%22120%22 height=%2260%22 fill=%22%23ccc%22/%3E%3C/svg%3E';
  const { code, json } = await run(fixture('iconring',
    'button{border:0;padding:0;background:#fff;color:#000;margin:20px;width:24px;height:24px;display:inline-flex}button svg{display:block}'
    + 'button:focus-visible{outline:2px solid #000;outline-offset:-2px}a{display:inline-block;margin:30px}a img{display:block}'
    + 'a.in:focus-visible{outline:3px solid #000;outline-offset:-3px}a.s1:focus-visible{outline:none;box-shadow:0 0 0 1px #000}'
    // an image that turns black on focus spans the link: hidden, it cannot carry the weak ring
    + 'a.big:focus-visible{outline:none;box-shadow:0 0 2px 0.25px #000}a.big:focus-visible img{filter:brightness(0)}',
    '<button type="button" class="ic" aria-label="Close"><svg width="24" height="24" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2"/></svg></button>'
    + `<a class="in" href="#in"><img alt="Inset" width="120" height="60" src="${img}"></a><a class="s1" href="#s1"><img alt="Ring" width="120" height="60" src="${img}"></a>`
    + `<a class="big" href="#big"><img alt="Banner" width="200" height="40" src="${img}"></a>`));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy}`), ['a.big pixels']);
  assert.strictEqual(code, 1);
});

test('a rotated, skewed or 3D-transformed control is unverified; a scaled one is measured', async () => {
  const { code, json } = await run(fixture('transformed',
    'div.t{margin:60px}button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px}button:focus-visible{outline:2px solid #000;outline-offset:2px}'
    + 'input{border:1px solid #000;background:#fff}.sc{transform:scale(1.5);transform-origin:0 0}.rot{transform:rotate(12deg)}.sk{transform:skewX(20deg)}'
    + '.p3{perspective:300px}.p3 > div{transform:rotateY(30deg)}',
    ['sc', 'rot', 'sk'].map((c) => `<div class="t ${c}"><button type="button" class="${c}">Go</button> <input aria-label="${c}" class="${c}"></div>`).join('')
    + '<div class="t p3"><div><button type="button" class="p3b">Go</button><input aria-label="p3" class="p3i"></div></div>'));
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.strictEqual(json.focusRingUnverified, 3, 'rot, sk and p3b');
  assert.strictEqual(json.controlBoundaryUnverified, 3, 'rot, sk and p3i');
  assert.strictEqual(code, 0);
});

// A plain button for the pixel tests below: w carries the weak ring, s a strong outline.
const BTN = 'body{margin:0}button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}'
  + `button.w:focus-visible{outline:none;${WEAK}}button.s:focus-visible{outline:2px solid #000;outline-offset:2px}`;
const SQUARE = (c, w, h) => `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22${w}%22 height=%22${h}%22%3E%3Crect width=%22${w}%22 height=%22${h}%22 fill=%22%23${c}%22/%3E%3C/svg%3E`;
// Runs each [name, css, body] fixture and returns, per name, its ring failures, unverified
// rings and exit code, so one comparison shows every fixture that differs.
async function rings(cases) {
  const got = {};
  for (const [name, css, body] of cases) {
    const { code, json } = await run(fixture(name, css, body));
    got[name] = { failures: json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy}`), unverified: json.focusRingUnverified, code };
  }
  return got;
}

// Pins that a control with an image is scored with the image shown: the image is hidden
// only to find the changed pixels. Scored with it hidden, the inset black outline sits on
// the white behind the image and passes at 21:1; drawn over the #333 image it is 1.66:1.
test('an inset ring over an image is scored against the image, not the white behind it', async () => {
  const { code, json } = await run(fixture('thumb',
    'body{margin:0}a{display:inline-block;margin:40px;background:#fff}a img{display:block}a.blk:focus-visible{outline:3px solid #000;outline-offset:-3px}',
    `<a class="blk" href="#a"><img alt="Dark photo" width="200" height="120" src="${SQUARE('333', 200, 120)}"></a>`));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy}`), ['a.blk pixels']);
  assert.ok(json.focusRingFailures[0].ratio < 2, `about 1.66:1 on the image: ${JSON.stringify(json.focusRingFailures)}`);
  assert.strictEqual(json.focusRingUnverified, 0);
  assert.strictEqual(code, 1);
});

// Pins that the moved-page check counts only the control's own pixels inside its box: an
// element animated beside it (by requestAnimationFrame, or a ticker on an interval) changes
// pixels in the clip on every shot. Counting the whole clip made the rings unverified.
test('a control next to an animated element is measured, not unverified', async () => {
  const css = `${BTN}.t{margin:60px;display:flex;gap:6px;align-items:center}.sp{width:24px;height:24px;background:#000}`;
  const got = await rings([
    ['raf', css, '<div class="t"><button type="button" class="w">W</button><span class="sp"></span><button type="button" class="s">S</button></div>'
      + '<script>const sp=document.querySelector(".sp");let a=0;(function f(){a+=12;sp.style.transform="rotate("+a+"deg)";requestAnimationFrame(f)})();</script>'],
    ['caro', css, '<div class="t"><button type="button" class="w">W</button><span class="sp"></span></div><div class="t"><button type="button" class="s">S</button><span class="sp"></span></div>'
      + '<script>let on=0;setInterval(()=>{on^=1;for(const t of document.querySelectorAll(".sp"))t.style.background=on?"#000":"#fff"},50);</script>'],
  ]);
  const fails = { failures: ['button.w pixels'], unverified: 0, code: 1 };
  assert.deepStrictEqual(got, { raf: fails, caro: fails });
});

// Pins the containing-block chain of the clip test: an absolute control is clipped only by
// an ancestor at or above its containing block, a fixed one only by a transformed, filtered
// or contained ancestor. Without the chain both overflow boxes count as clipping and every
// ring here is unverified.
test('a control positioned out of an overflow box is measured, not unverified', async () => {
  const got = await rings([
    ['absesc', `${BTN}.cb{position:relative;margin:60px;height:200px}.ov{overflow:hidden;height:30px;width:150px}.ov button{position:absolute;top:80px;left:0}.ov button.s{left:140px}`,
      '<div class="cb"><div class="ov"><button type="button" class="w">W</button><button type="button" class="s">S</button></div></div>'],
    ['fixin', `${BTN}.shell{height:200px;overflow:auto;width:300px;margin:40px}.fab{position:fixed;bottom:40px;right:40px}.fab button.s{margin-left:8px}`,
      '<div class="shell"><p>App</p><div style="height:600px"></div><div class="fab"><button type="button" class="w">W</button><button type="button" class="s">S</button></div></div>'],
  ]);
  const fails = { failures: ['button.w pixels'], unverified: 0, code: 1 };
  assert.deepStrictEqual(got, { absesc: fails, fixin: fails });
});

// Pins what "paints nothing" excludes in the cover test: a replaced element (img, canvas,
// iframe), an empty element painted by its ::before and one with a backdrop-filter all
// paint over the control. Taken for transparent, they let the hidden strong ring fail at 1:1.
test('a strong ring under an image, canvas, iframe, pseudo-element or backdrop filter is unverified', async () => {
  const cover = 'position:absolute;top:90px;left:80px;width:340px;height:60px';
  const row = '<div class="row"><button type="button" class="s">S</button></div>';
  const css = `${BTN}.row{position:absolute;top:100px;left:100px}`;
  const got = await rings([
    ['imgc', `${css}img.cov{${cover}}`, `${row}<img class="cov" alt="" src="${SQUARE('36c', 340, 60)}">`],
    ['canc', `${css}canvas{${cover}}`, `${row}<canvas width="340" height="60"></canvas><script>const c=document.querySelector("canvas").getContext("2d");c.fillStyle="#36c";c.fillRect(0,0,340,60);</script>`],
    ['ifr', `${css}iframe{${cover.replace('absolute', 'fixed')};border:0}`, `${row}<iframe title="chat" srcdoc="<body style='margin:0;background:#36c'></body>"></iframe>`],
    ['pse', `${css}.ov{${cover}}.ov::before{content:"";position:absolute;inset:0;background:#36c}`, `${row}<div class="ov"></div>`],
    ['bdf', `${css}.ov{${cover};backdrop-filter:blur(6px)}`, `${row}<div class="ov"></div>`],
  ]);
  const unv = { failures: [], unverified: 1, code: 0 };
  assert.deepStrictEqual(got, { imgc: unv, canc: unv, ifr: unv, pse: unv, bdf: unv });
});

// Pins the unverified cases of a control only partly visible: off the left edge of the
// viewport (no scroll can bring it in), inside a contain: paint or a clip-path box (beside
// overflow: clip, which was already handled) and inside a content-visibility: auto box.
// Measured, the strong ring is cut where the control is cut and fails on its extent.
test('a strong ring on a control only partly visible is unverified', async () => {
  const box = 'width:180px;height:60px;margin:60px;padding:15px 0 0 0';
  const got = await rings([
    ['edge', `${BTN}.e{position:absolute;top:100px;left:-40px}`, '<button type="button" class="s e">Edge</button>'],
    ['ovc', `${BTN}.c{overflow:clip;${box}}.cp{contain:paint;${box}}.ci{clip-path:inset(0);${box}}.c button,.cp button,.ci button{margin-left:100px}`,
      '<div class="c"><button type="button" class="s">S</button></div><div class="cp"><button type="button" class="s">S</button></div>'
      + '<div class="ci"><button type="button" class="s">S</button></div>'],
    ['cv', `${BTN}.cv{content-visibility:auto;${box}}.cv button{margin-left:100px}`, '<div class="cv"><button type="button" class="s">S</button></div>'],
  ]);
  assert.deepStrictEqual(got, {
    edge: { failures: [], unverified: 1, code: 0 },
    ovc: { failures: [], unverified: 3, code: 0 },
    cv: { failures: [], unverified: 1, code: 0 },
  });
});

// Pins the boundary side of the same rule: an input off the left edge of the viewport is not
// sampled on its visible part (inView(g, 0) in verifyBoundaries), so it is unverified.
test('a form field only partly inside the viewport is unverified, not measured', async () => {
  const { code, json } = await run(fixture('edgefield', 'input.e{position:absolute;top:100px;left:-40px;width:200px;border:1px solid #000;background:#fff}',
    '<input class="e" aria-label="Edge">'));
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.strictEqual(json.controlBoundaryUnverified, 1);
  assert.strictEqual(code, 0);
});

// Pins two transform cases. The rotate property (not transform) makes a control unverified
// like a rotated transform; unread, the controls are sampled on axis-aligned lines and the
// input's border fails at 1:1. And a transform applied only on focus is pinned to its
// unfocused value for the focused shots (the two boxes overlap by at least half), also for the shot with the icons shown: unpinned,
// the 1 px lift or the scale moves the black border onto the ring and the weak ring passes.
test('the rotate property makes a control unverified; a transform on focus does not hide a weak ring', async () => {
  const rot = await run(fixture('rotp', `${BTN}.t{margin:60px}.r{rotate:8deg}input{border:1px solid #000;background:#fff;margin:20px}`,
    '<div class="t"><button type="button" class="w r">W</button> <button type="button" class="s r">S</button> <input class="r" aria-label="r"></div>'));
  assert.deepStrictEqual(rot.json.focusRingFailures, []);
  assert.deepStrictEqual(rot.json.controlBoundaryFailures, []);
  assert.strictEqual(rot.json.focusRingUnverified, 2, 'button.w and button.s');
  assert.strictEqual(rot.json.controlBoundaryUnverified, 1, 'the input');
  assert.strictEqual(rot.code, 0);
  const tf = await run(fixture('focustf', `${BTN}.t{margin:60px}button.l:focus-visible,button.ic:focus-visible{transform:translateY(-1px)}button.g:focus-visible{transform:scale(1.03)}button svg{vertical-align:middle}`,
    '<div class="t"><button type="button" class="w l">Lift</button> <button type="button" class="w n">Plain</button></div>'
    + '<div class="t"><button type="button" class="w g">Grow</button></div>'
    + '<div class="t"><button type="button" class="w ic"><svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" fill="currentColor"/></svg> Icon</button></div>'));
  assert.deepStrictEqual(tf.json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy}`).sort(),
    ['button.w.g pixels', 'button.w.ic pixels', 'button.w.l pixels', 'button.w.n pixels']);
  for (const f of tf.json.focusRingFailures) assert.ok(f.ratio > 1.8 && f.ratio < 2.3, `about 2.07:1: ${JSON.stringify(f)}`);
  assert.strictEqual(tf.code, 1);
});

test('a page whose debounced scroll handler moves the layout between the shots is unverified, not failed', async () => {
  const page = path.join(dir, 'scrollshift.html');
  fs.writeFileSync(page, '<!doctype html><html lang="en"><title>scrollshift</title><style>body{margin:0;background:#fff;color:#000}'
    + '.long{height:2500px}button{color:#000;background:#fff;border:1px solid #000}button:focus-visible{outline:2px solid #000;outline-offset:2px}'
    + 'body.s .sp{margin-top:40px}</style><main><p class="sp">Spacer</p><div class="long"></div><button type="button" class="low">Low</button></main>'
    + '<script>let t;addEventListener("scroll",()=>{clearTimeout(t);t=setTimeout(()=>document.body.classList.toggle("s",scrollY>50),50)});</script></html>');
  const { code, json } = await run(page);
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.strictEqual(json.focusRingUnverified, 1);
  assert.strictEqual(code, 0);
});

// Like rings(), with each failure's ratio to one decimal (the weak ring paints about 2.07:1).
async function ringsAt(cases) {
  const got = {};
  for (const [name, css, body] of cases) {
    const { code, json } = await run(fixture(name, css, body));
    got[name] = { failures: json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy} ${f.ratio.toFixed(1)}`), unverified: json.focusRingUnverified, code };
  }
  return got;
}

// Pins the moving-neighbour rule: pixels that change between the three unfocused shots are
// never ring pixels, and such a piece as long as the ring must be makes the control
// unverified. The bar below the button takes a random grey each frame, so the three shots
// catch it changing unless all three show the same grey (estimated at one run in 2,600;
// measured: 60 of 60 runs unverified): the test is not strictly deterministic. Without the
// rule the bar, recoloured by 3:1 or more between the unfocused and the focused shot,
// carries the weak ring in about half the runs (10 of 20) and fails it at 2.07 in the
// others; without the unverified half, the ring fails at 2.07. The striped bar at rest is
// not noise and the ring fails on it.
test('a ring beside a long animated bar is unverified; beside a striped bar at rest it fails', async () => {
  const css = `${BTN}button{width:200px}.t{margin:60px}.bar{width:200px;height:3px;margin-top:4px;background:repeating-linear-gradient(90deg,#000 0 4px,#fff 4px 8px)}`;
  const body = '<div class="t"><button type="button" class="w">W</button><div class="bar"></div></div>';
  for (let k = 0; k < 2; k++) {
    const { anim } = await ringsAt([['anim', css, body
      + '<script>const b=document.querySelector(".bar");(function f(){const g=(Math.random()*256)|0;b.style.background="rgb("+g+","+g+","+g+")";requestAnimationFrame(f)})();</script>']]);
    assert.deepStrictEqual(anim, { failures: [], unverified: 1, code: 0 }, `run ${k}`);
  }
  const { still } = await ringsAt([['still', css, body]]);
  assert.deepStrictEqual(still, { failures: ['button.w pixels 2.1'], unverified: 0, code: 1 });
});

// Pins the skip-link rule. Only the focused box must lie in the viewport: one that waits off
// the left edge, above the top or moved up by a transform was unverified because the union
// of both boxes left the viewport. And a focus transform is pinned to its unfocused value
// only where the two boxes overlap by half: pinned, the transform skip link stays out of
// view in the focused shot and its strong ring fails at 1:1. The weak ring of a skip link
// without a border still fails.
test('a skip link brought into view by left, top or a transform is measured', async () => {
  const skip = 'a.skip{position:absolute;background:#fff;color:#000;padding:8px 16px;border:1px solid #000;z-index:10}';
  const strong = 'a.skip:focus{outline:3px solid #000;outline-offset:2px}';
  const got = await ringsAt([
    ['skleft', `${skip}a.skip{left:-9999px;top:8px}a.skip:focus{left:8px}${strong}`, '<a class="skip" href="#m">Skip to content</a>'],
    ['sktop', `${skip}a.skip{left:8px;top:-60px}a.skip:focus{top:8px}${strong}`, '<a class="skip" href="#m">Skip to content</a>'],
    ['sktf', `${skip}a.skip{left:8px;top:8px;transform:translateY(-200%)}a.skip:focus{transform:none}${strong}`, '<a class="skip" href="#m">Skip to content</a>'],
    ['sklight', 'a.skip{position:absolute;left:-9999px;top:8px;background:#eee;color:#000;padding:8px 16px}'
      + `a.skip:focus{left:8px;outline:none;${WEAK}}`, '<a class="skip" href="#m">Skip to content</a>'],
  ]);
  const ok = { failures: [], unverified: 0, code: 0 };
  assert.deepStrictEqual(got, { skleft: ok, sktop: ok, sktf: ok, sklight: { failures: ['a.skip pixels 2.1'], unverified: 0, code: 1 } });
});

// Pins the image rule: with icons or images in a control, a pixel counts as changed only
// when it changed in both pairs, with them hidden and with them shown. An inset ring drawn
// under an opaque image (box-shadow: inset paints below content) is seen in the hidden pair
// only; counted there, it passed on the image's own dark frame. The thumb test above pins
// that a ring over the image is still scored against it.
test('an inset ring hidden under an opaque image fails at 1:1', async () => {
  const frame = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22120%22%3E%3Crect width=%22200%22 height=%22120%22 fill=%22%23fff%22/%3E'
    + '%3Crect x=%221%22 y=%221%22 width=%22198%22 height=%22118%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22/%3E%3C/svg%3E';
  const got = await ringsAt([['imgframe', 'body{margin:0}a{display:inline-block;margin:40px;background:#fff}a img{display:block}a:focus-visible{outline:none;box-shadow:inset 0 0 0 4px #000}',
    `<a href="#a"><img alt="Framed" width="200" height="120" src="${frame}"></a>`]]);
  assert.deepStrictEqual(got, { imgframe: { failures: ['a pixels 1.0'], unverified: 0, code: 1 } });
});

// Pins registration by offset: where focus moves the box by whole pixels at the same size
// (a :focus-within transform on a card, top: -1px, a negative margin), each focused pixel is
// compared with the unfocused pixel it moved from, and also in place. Compared only in
// place, the moved black border is a 21:1 change along the whole side and carries the weak
// ring; compared only shifted, a black bar that stayed below the button is one. Strong rings
// with the same lifts still pass.
test('a weak ring on a control lifted by an ancestor, top or a margin fails; a strong one passes', async () => {
  const css = `${BTN}button{width:160px}.t{margin:60px}.card{margin:60px;padding:12px;width:200px;background:#fff}.card:focus-within{transform:translateY(-3px)}`
    + 'button.top:focus-visible{position:relative;top:-1px}button.mg:focus-visible{margin-top:-2px;margin-bottom:2px}.bar{width:200px;height:3px;margin-top:4px;background:#000}';
  const got = await ringsAt([
    ['cardw', css, '<div class="card"><button type="button" class="w">Card</button></div>'],
    ['cards', css, '<div class="card"><button type="button" class="s">Card</button></div>'],
    ['topw', css, '<div class="t"><button type="button" class="w top">Top</button></div>'],
    ['tops', css, '<div class="t"><button type="button" class="s top">Top</button></div>'],
    ['topbar', css, '<div class="t"><button type="button" class="w top">Top</button><div class="bar"></div></div>'],
    ['mgw', css, '<div class="t"><button type="button" class="w mg">Margin</button></div>'],
  ]);
  const weak = (el) => ({ failures: [`${el} pixels 2.1`], unverified: 0, code: 1 });
  const ok = { failures: [], unverified: 0, code: 0 };
  assert.deepStrictEqual(got, { cardw: weak('button.w'), cards: ok, topw: weak('button.w.top'), tops: ok, topbar: weak('button.w.top'), mgw: weak('button.w.mg') });
});

// Pins two inputs of the clip and pin geometry. The translate and scale properties (Tailwind
// v4 writes them, not transform) are part of the pinned transform: unpinned, the 3% growth
// moves the border onto the weak ring and it passes (translate alone would now be caught by
// registration, so the scaled button is the one that discriminates). And a fixed control's
// containing block is a transformed, perspective or filtered ancestor: with that ancestor's
// overflow on the chain, the control is scrolled into it and its strong ring passes; without
// it, the ring is cut at the ancestor's edge and fails at 21:1 for its length.
test('translate and scale are pinned; a fixed control in a transformed, perspective or filtered box is scrolled into it', async () => {
  const tw = await ringsAt([['tw4', `${BTN}.t{margin:60px}button.w:focus-visible{translate:0 -1px}button.w.sc:focus-visible{translate:none;scale:1.03}`,
    '<div class="t"><button type="button" class="w">Lift</button> <button type="button" class="w sc">Grow</button></div>']]);
  assert.deepStrictEqual(tw, { tw4: { failures: ['button.w pixels 2.1', 'button.w.sc pixels 2.1'], unverified: 0, code: 1 } });
  const shell = (cb) => `${BTN}.shell{${cb};overflow:hidden;width:200px;height:100px;margin:60px;border:1px solid #888}button{position:fixed;left:140px;top:30px}`;
  const body = '<div class="shell"><button type="button" class="s">Fixed</button></div>';
  const got = await ringsAt([['cbtf', shell('transform:translateX(0)'), body], ['cbpersp', shell('perspective:300px'), body], ['cbfilter', shell('filter:brightness(1)'), body]]);
  const ok = { failures: [], unverified: 0, code: 0 };
  assert.deepStrictEqual(got, { cbtf: ok, cbpersp: ok, cbfilter: ok });
});

// Pins that the moved-page check counts only pixels that show the control: a badge drawn over
// the button, recoloured on every frame (by a step of 7, so any two shots differ), changes
// pixels inside the box on every shot. Counted, the strong ring is unverified.
test('a badge animated over a control does not make it unverified', async () => {
  const got = await ringsAt([['badge', `${BTN}.t{margin:60px;position:relative;display:inline-block}.bd{position:absolute;left:10px;top:4px;width:90px;height:22px;background:#c00}`,
    '<div class="t"><button type="button" class="s">Badge</button><span class="bd"></span></div>'
    + '<script>const b=document.querySelector(".bd");let n=0;(function f(){n+=7;b.style.background="rgb("+(n%256)+",0,80)";requestAnimationFrame(f)})();</script>']]);
  assert.deepStrictEqual(got, { badge: { failures: [], unverified: 0, code: 0 } });
});

// Pins the noise mask of a skip link. Unfocused, a skip link shows none of itself, so its
// focused pixels decide where an animated neighbour hides the ring; counted over the
// unfocused ones, no pixel counts and the long-neighbour rule never fires. A hero
// recoloured each frame (by a step of 41) behind the whole link: unverified; without this
// fix the strong ring fails at 1:1. A band of 6 px across the top of the ring: unverified;
// without this fix the control passes. The same skip link over a hero at rest passes.
test('a skip link over an animated hero or band is unverified; over a hero at rest it passes', async () => {
  const base = 'body{margin:0;font:14px sans-serif}.hero{position:absolute;left:0;top:0;width:100%;height:300px}';
  const skipL = 'a.skip{position:absolute;left:-9999px;top:8px;z-index:10;padding:8px 16px;background:#fff;color:#000;border:1px solid #000}a.skip:focus{left:8px;outline:3px solid #000;outline-offset:2px}';
  const skipT = 'a.skip{position:absolute;left:8px;top:8px;z-index:10;padding:8px 16px;background:#fff;color:#000;border:1px solid #000;transform:translateY(-200%)}a.skip:focus{transform:none;outline:3px solid #000;outline-offset:2px}';
  const anim = '<script>const h=document.querySelector(".hero");let n=0;(function f(){n+=41;const g=n%256;h.style.background="rgb("+g+","+(255-g)+",120)";requestAnimationFrame(f)})();</script>';
  const body = '<a class="skip" href="#m">Skip to content</a><div class="hero"></div><p id="m" style="margin-top:320px">Main</p>';
  const band = '.hero{height:6px}';
  const got = await ringsAt([
    ['heroleftstill', `${base}${skipL}.hero{background:#357}`, body],
    ['heroleft', `${base}${skipL}`, body + anim],
    ['herotf', `${base}${skipT}`, body + anim],
    ['bandleft', `${base}${band}${skipL}`, body + anim],
    ['bandtf', `${base}${band}${skipT}`, body + anim],
  ]);
  const unv = { failures: [], unverified: 1, code: 0 };
  assert.deepStrictEqual(got, { heroleftstill: { failures: [], unverified: 0, code: 0 }, heroleft: unv, herotf: unv, bandleft: unv, bandtf: unv });
});

// Pins the hidden-pixel rule. A narrow bar behind the button, recoloured each frame (a grey
// stepping by 37), cuts the strong ring at the top and at the bottom. Its pixels are left
// out of the ring, so the ring splits into two halves of 61 px where 116 are needed and
// failed at 21:1. Taken at 21:1, the hidden pixels complete it: unverified. The weak ring
// is not completed by them and still fails.
test('a strong ring cut twice by an animated bar is unverified; a weak one still fails', async () => {
  const BTNZ = 'body{margin:0}button{position:relative;z-index:1;color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}'
    + `button.w:focus-visible{outline:none;${WEAK}}button.s:focus-visible{outline:2px solid #000;outline-offset:2px}`;
  const css = `${BTNZ}.t{position:relative;margin:60px;display:inline-block}.v{position:absolute;left:57px;top:-15px;width:6px;height:60px;background:#888}`;
  const anim = '<script>const v=document.querySelector(".v");let n=0;(function f(){n+=37;const g=n%256;v.style.background="rgb("+g+","+g+","+g+")";requestAnimationFrame(f)})();</script>';
  const got = await ringsAt([
    ['cut2s', css, `<div class="t"><button type="button" class="s">Cut</button><span class="v"></span></div>${anim}`],
    ['cut2w', css, `<div class="t"><button type="button" class="w">Cut</button><span class="v"></span></div>${anim}`],
  ]);
  assert.deepStrictEqual(got, { cut2s: { failures: [], unverified: 1, code: 0 }, cut2w: { failures: ['button.w pixels 2.2'], unverified: 0, code: 1 } });
});

// Pins the noise exclusion at the candidate filter: a pixel that changes between the
// unfocused shots is no ring pixel. The bar of the test above, stepping through dark greys
// only (0 to 59): scored like ring pixels, against the grey the bar showed unfocused, its
// pixels cut the strong ring at below 3:1 and it fails below 2:1. Left out, the ring is
// unverified.
test('pixels of an animated bar are not scored as ring pixels', async () => {
  const BTNZ = 'body{margin:0}button{position:relative;z-index:1;color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}'
    + 'button.s:focus-visible{outline:2px solid #000;outline-offset:2px}';
  const css = `${BTNZ}.t{position:relative;margin:60px;display:inline-block}.v{position:absolute;left:57px;top:-15px;width:6px;height:60px;background:#888}`;
  const anim = '<script>const v=document.querySelector(".v");let n=0;(function f(){n+=37;const g=n%60;v.style.background="rgb("+g+","+g+","+g+")";requestAnimationFrame(f)})();</script>';
  const got = await ringsAt([['cut2dark', css, `<div class="t"><button type="button" class="s">Cut</button><span class="v"></span></div>${anim}`]]);
  assert.deepStrictEqual(got, { cut2dark: { failures: [], unverified: 1, code: 0 } });
});

// Pins the vacated strip of a registered lift. Focus lifts the button by 2 px (top: -2px,
// or an ancestor's :focus-within transform) off a black bar directly below it. Registered,
// an outside pixel over the strip the button left was scored against the pixel it moved
// from, the black bar, and the weak ring passed at about 18:1 there; it paints 2.07:1 and
// fails.
// Strong rings with the same lifts still pass, and a weak ring lifted 1 px without a bar
// fails.
test('a weak ring lifted off a dark neighbour fails; strong rings with the same lift pass', async () => {
  const BTN2 = 'body{margin:0}button{color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif;display:block}'
    + `button.w:focus-visible{outline:none;${WEAK}}button.s:focus-visible{outline:2px solid #000;outline-offset:2px}`;
  const bar = '.bar{width:200px;height:4px;background:#000}';
  const BTNZ = 'body{margin:0}button{position:relative;z-index:1;color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}'
    + `button.w:focus-visible{outline:none;${WEAK}}button.s:focus-visible{outline:2px solid #000;outline-offset:2px}`;
  const ring1 = 'button.r:focus-visible{outline:1px solid #000;outline-offset:0}';
  const got = await ringsAt([
    ['adjtop2w', `${BTN2}${bar}.t{margin:60px}button:focus-visible{position:relative;top:-2px}`, '<div class="t"><button type="button" class="w">Lift</button><div class="bar"></div></div>'],
    ['adjtop2s', `${BTN2}${bar}.t{margin:60px}button:focus-visible{position:relative;top:-2px}`, '<div class="t"><button type="button" class="s">Lift</button><div class="bar"></div></div>'],
    ['adjcardw', `${BTN2}${bar}.t{margin:60px}.wrap:focus-within{transform:translateY(-2px)}`, '<div class="t"><div class="wrap"><button type="button" class="w">Lift</button></div><div class="bar"></div></div>'],
    ['lift1weak', `${BTNZ}.card{margin:60px;padding:12px;width:200px}.card:focus-within{transform:translateY(-1px)}`, '<div class="card"><button type="button" class="w">Card</button></div>'],
    ['lift1ring2', `${BTNZ}${ring1}.card{margin:60px;padding:12px;width:200px}.card:focus-within{transform:translateY(-1px)}`, '<div class="card"><button type="button" class="r">Card</button></div>'],
  ]);
  const weak = { failures: ['button.w pixels 2.1'], unverified: 0, code: 1 };
  const ok = { failures: [], unverified: 0, code: 0 };
  assert.deepStrictEqual(got, { adjtop2w: weak, adjtop2s: ok, adjcardw: weak, lift1weak: weak, lift1ring2: ok });
});

// Pins the ancestor-transform rule: a card that scales on :focus-within (by transform or by
// the scale property) resizes the box, so the move cannot be registered, and compared in
// place its moved border carried the weak ring. Unverified, the strong ring too.
test('a control in a card that scales on focus is unverified', async () => {
  const BTN1 = 'body{margin:0}button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}'
    + `button.w:focus-visible{outline:none;${WEAK}}button.s:focus-visible{outline:2px solid #000;outline-offset:2px}`;
  const card = `${BTN1}.card{margin:60px;padding:12px;width:200px;background:#fff}.card:focus-within{transform:scale(1.05)}`;
  const tw = 'body{margin:0;font:14px sans-serif}.card{margin:60px;padding:16px;width:240px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}.card:focus-within{scale:1.05}'
    + `a{display:inline-block;padding:4px;color:#000;border:1px solid #000}a:focus-visible{outline:none;${WEAK}}`;
  const got = await ringsAt([
    ['scalew', card, '<div class="card"><button type="button" class="w">Card</button></div>'],
    ['scales', card, '<div class="card"><button type="button" class="s">Card</button></div>'],
    ['twcardscale', tw, '<div class="card"><a href="#x">Read more</a></div>'],
  ]);
  const unv = { failures: [], unverified: 1, code: 0 };
  assert.deepStrictEqual(got, { scalew: unv, scales: unv, twcardscale: unv });
});

test('of two color-scheme meta tags the first that parses decides', async () => {
  // Pins the `break` in the meta loop: of "dark" then "light" (both parse) the first wins, so
  // the button keeps the browser ring of the dark scheme; with the last one winning it
  // reads as an author outline in #eee and fails at 1.16:1.
  for (const [i, metas] of [['light, dark', 'dark'], ['', 'dark'], ['dark', 'light']].entries()) {
    const page = path.join(dir, `twometa${i}.html`);
    fs.writeFileSync(page, `<!doctype html><html lang="en"><head>${metas.map((c) => `<meta name="color-scheme" content="${c}">`).join('')}<title>m</title>`
      + '<style>body{background:#fff;color:#000}</style></head><body><main><button type="button">Meta</button></main></body></html>');
    const { json } = await run(page);
    assert.deepStrictEqual(json.focusRingFailures, [], metas.join(' | '));
    assert.strictEqual(json.focusUserAgentRing, 1, metas.join(' | '));
  }
});

// Writes a whole page (own <style> and <script>) and audits it.
async function page(name, html) {
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, `<!doctype html><html lang="en"><title>${name}</title>${html}</html>`);
  return run(file);
}

// Pins the scoring of the strip a lifted control vacates: a ring with no top line (an offset
// spread shadow as an underline) lies over that strip after a 2 px lift. Not scored there, the
// short sides alone failed it at 21:1; scored against the surfaces it may lie on, it passes.
test('a strong ring with no top line still passes after a lift', async () => {
  const css = 'body{background:#fff;color:#000;margin:0}button{color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif}.t{margin:60px}';
  for (const [name, rule, body] of [
    ['striptop', 'button:focus-visible{outline:none;position:relative;top:-2px;box-shadow:0 1px 0 1px #000}', '<div class="t"><button type="button">Bar</button></div>'],
    ['stripcard', '.card:focus-within{transform:translateY(-2px)}button:focus-visible{outline:none;box-shadow:0 1px 0 1px #000}', '<div class="t"><div class="card"><button type="button">Bar</button></div></div>'],
  ]) {
    const { code, json } = await page(name, `<style>${css}${rule}</style><main>${body}</main>`);
    assert.deepStrictEqual({ failures: json.focusRingFailures, unverified: json.focusRingUnverified, code }, { failures: [], unverified: 0, code: 0 }, name);
  }
});

// Pins the rule that a ring whose changed pixels all lie under an animated neighbour cannot be
// read: an overlay recoloured each frame covers the button until focus raises it. Without the
// rule no candidate is left and the strong ring fails at 1:1.
test('a ring whose changed pixels all lie under an animation is unverified', async () => {
  const { code, json } = await page('shimmer', '<style>body{background:#fff;color:#000;margin:0}.t{position:relative;margin:60px;display:inline-block}'
    + 'button{position:relative;color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif}'
    + 'button:focus-visible{z-index:3;outline:2px solid #000;outline-offset:2px}.sh{position:absolute;left:-20px;top:-20px;width:200px;height:70px;z-index:2;background:rgb(240,240,240)}</style>'
    + '<main><div class="t"><button type="button">Shimmer</button><span class="sh"></span></div></main>'
    + '<script>const s=document.querySelector(".sh");let n=0;(function f(){n+=7;const g=200+(n%56);s.style.background="rgb("+g+","+g+","+g+")";requestAnimationFrame(f)})();</script>');
  assert.deepStrictEqual({ failures: json.focusRingFailures, unverified: json.focusRingUnverified, code }, { failures: [], unverified: 1, code: 0 });
});

// Pins the sub-pixel half of the ancestor-transform rule: a card lifted by half a pixel on
// focus cannot be registered, so the control is unverified; counted as measured, the moved
// border carries the weak ring.
test('a card lifted by a fraction of a pixel on focus leaves its control unverified', async () => {
  const { code, json } = await page('subpxcard', '<style>body{background:#fff;color:#000;margin:0}'
    + 'button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}button.w:focus-visible{outline:none;box-shadow:0 0 2px 0.25px #000}'
    + '.card{margin:60px;padding:12px;width:200px}.card:focus-within{transform:translateY(-0.5px)}</style>'
    + '<main><div class="card"><button type="button" class="w">Card</button></div></main>');
  assert.deepStrictEqual({ failures: json.focusRingFailures, unverified: json.focusRingUnverified, code }, { failures: [], unverified: 1, code: 0 });
});

// Pins that the all-hidden rule goes through the completion test: a ring that paints nothing
// (a blend mode that hides it; an inset ring under an opaque framed image) next to an 8 px
// dot recoloured each frame fails at 1:1. The dot cannot hide a ring that long, so taking it
// for one that cannot be read would turn both failures into unverified controls.
test('a ring that paints nothing next to a small animation still fails at 1:1', async () => {
  for (const [name, html, el] of [['blenddot', "<style>body{margin:0;background:#fff;color:#000}button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}.w{position:relative;margin:80px 100px;display:inline-block}.b{mix-blend-mode:difference;display:inline-block}button:focus-visible{outline:2px solid #000}.sp{position:absolute;left:124px;top:11px;width:8px;height:8px;background:#888}</style><main><div class=\"w\"><div class=\"b\"><button type=\"button\">Go</button></div><span class=\"sp\"></span></div></main><script>const s=document.querySelector(\".sp\");let n=0;(function f(){n+=37;const g=n%256;s.style.background=\"rgb(\"+g+\",\"+g+\",\"+g+\")\";requestAnimationFrame(f)})();</script>", 'button'], ['imgdot', "<style>body{margin:0;background:#fff}.w{position:relative;display:inline-block;margin:40px}a{display:inline-block;background:#fff}a img{display:block}a:focus-visible{outline:none;box-shadow:inset 0 0 0 4px #000}.sp{position:absolute;left:204px;top:56px;width:8px;height:8px;background:#888}</style><main><div class=\"w\"><a href=\"#a\"><img alt=\"Framed\" width=\"200\" height=\"120\" src=\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22120%22%3E%3Crect width=%22200%22 height=%22120%22 fill=%22%23fff%22/%3E%3Crect x=%221%22 y=%221%22 width=%22198%22 height=%22118%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22/%3E%3C/svg%3E\"></a><span class=\"sp\"></span></div></main><script>const s=document.querySelector(\".sp\");let n=0;(function f(){n+=37;const g=n%256;s.style.background=\"rgb(\"+g+\",\"+g+\",\"+g+\")\";requestAnimationFrame(f)})();</script>", 'a']]) {
    const { code, json } = await page(name, html);
    assert.deepStrictEqual({ failures: json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy} ${f.ratio}`), unverified: json.focusRingUnverified, code },
      { failures: [`${el} pixels 1`], unverified: 0, code: 1 }, name);
  }
});

// Pins how the strip a lifted control vacates is scored: against the pixel it moved from
// and the surface behind the control, read from focused shots with it at opacity 0. Sampled
// beside the control instead, a weak ring in a dark group above a black bar passed, and a
// strong underline next to one dark neighbour failed at 1.32.
test('the vacated strip is scored against the surface behind the control', async () => {
  const weak = await page('darkgroup', "<style>body{margin:0;background:#fff;color:#000}button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif;margin:0}.t{margin:60px;width:360px}.g{display:flex}.g .d{background:#222;color:#fff;border-color:#222}.bar{height:4px;background:#000}button.f:focus-visible{outline:none;box-shadow:0 0 2px 0.25px #000;position:relative;top:-2px}</style><main><div class=\"t\"><div class=\"g\"><button type=\"button\" class=\"d\" tabindex=\"-1\">L</button><button type=\"button\" class=\"f\">F</button><button type=\"button\" class=\"d\" tabindex=\"-1\">R</button></div><div class=\"bar\"></div></div></main>");
  assert.deepStrictEqual(weak.json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy} ${f.ratio}`), ['button.f pixels 2.07']);
  const strong = await page('darkleft', "<style>body{margin:0;background:#fff;color:#000}button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}.g{display:flex;margin:60px}.g button{margin:0;width:160px}.g .d{background:#222;color:#fff;border-color:#222}button.f:focus-visible{outline:none;position:relative;top:-2px;box-shadow:0 1px 0 1px #000}</style><main><div class=\"g\"><button type=\"button\" class=\"d\" tabindex=\"-1\">L</button><button type=\"button\" class=\"f\">F</button></div></main>");
  assert.deepStrictEqual({ failures: strong.json.focusRingFailures, unverified: strong.json.focusRingUnverified, code: strong.code }, { failures: [], unverified: 0, code: 0 });
});

// A button lifted by 2px onto a #222 rule right above it, with its fill and focus style.
const ruleAbove = (fill, focus) => `<style>body{margin:0;background:#fff;color:#000;font:14px sans-serif}.t{position:relative;margin:60px;width:160px}.rule{position:absolute;left:0;right:0;top:-2px;height:2px;background:#222}button{display:block;margin:0;color:#000;background:${fill};border:1px solid #000;width:160px;height:30px;font:14px sans-serif;position:relative}button:focus-visible{top:-2px;${focus}}</style><main><div class="t"><div class="rule"></div><button type="button">Go</button></div></main>`;

// Pins round 34's rules for the strip a lifted control vacates and the all-hidden threshold.
test('the strip behind a lifted control is read in its focused state, and only a ring-long animation hides a ring', async () => {
  const got = {}; const want = {};
  for (const [name, html, failures] of [
    // a card that lifts on focus-within carries a plate behind the button: the strip is read behind the focused control, a pass
    ["ancestorlift", "<style>body{background:#fff;color:#000;margin:0}.card{position:relative;display:inline-block;margin:60px}.card:focus-within{transform:translateY(-2px)}.sh{position:absolute;left:0;top:0;right:0;bottom:0;background:#222}button{position:relative;color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif;margin:0;display:block}button:focus-visible{outline:none;box-shadow:0 1px 0 1px #000}</style><main><div class=\"card\"><div class=\"sh\"></div><button type=\"button\">Bar</button></div></main>", []],
    // a child with visibility: visible stays painted under visibility: hidden; at opacity 0 the strip is read behind it, a pass
    ["visiblechild", "<style>body{background:#fff;color:#000;margin:0}button{color:#fff;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif;padding:0}.t{margin:60px}.in{visibility:visible;display:block;height:100%;background:#222;color:#fff}button:focus-visible{outline:none;position:relative;top:-2px;box-shadow:0 1px 0 1px #000}</style><main><div class=\"t\"><button type=\"button\"><span class=\"in\">Bar</span></button></div></main>", []],
    // B lies over the lifted A: A must be shown again after its hidden shots, or B reads over white and passes
    ["showself", "<style>body{background:#fff;color:#000;margin:0;font:14px sans-serif}.c{display:flex;flex-direction:column-reverse;margin:60px;width:160px}button{color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;margin:0;font:14px sans-serif}.a{background:#222;color:#fff;border-color:#222}.a:focus-visible{outline:2px solid #000;outline-offset:2px;position:relative;top:-2px}.b:focus-visible{outline:none;box-shadow:0 1px 0 1px #000}</style><main><div class=\"c\"><button type=\"button\" class=\"a\">A</button><button type=\"button\" class=\"b\">B</button></div></main>", ["button.b pixels 21"]],
    // a dark bar directly below a lifted button: the pixel the ring moved from still counts
    ["srcbar", "<style>body{background:#fff;color:#000;margin:0;font:14px sans-serif}.t{margin:60px;width:160px}button{display:block;margin:0;color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif}.bar{height:6px;background:#111}button:focus-visible{outline:none;position:relative;top:-2px;box-shadow:0 1px 0 1px #000}</style><main><div class=\"t\"><button type=\"button\">Go</button><div class=\"bar\"></div></div></main>", ["button pixels 1.11"]],
    // an 80 px animated bar beside a ring that paints nothing: shorter than a ring must be, so a failure, not unverified
    ["bar80", "<style>body{margin:0;background:#fff;color:#000}button{color:#000;background:#fff;border:1px solid #000;width:120px;height:30px;font:14px sans-serif}.w{position:relative;margin:80px 100px;display:inline-block}.b{mix-blend-mode:difference;display:inline-block}button:focus-visible{outline:2px solid #000}.sp{position:absolute;left:20px;top:-10px;width:80px;height:6px;background:#888}</style><main><div class=\"w\"><div class=\"b\"><button type=\"button\">Go</button></div><span class=\"sp\"></span></div></main><script>const s=document.querySelector(\".sp\");let n=0;(function f(){n+=37;const g=n%256;s.style.background=\"rgb(\"+g+\",\"+g+\",\"+g+\")\";requestAnimationFrame(f)})();</script>", ["button pixels 1"]],
    // the documented false failure: a light plate behind a white ring on a dark page; the
    // failure names the plate, the colour its ratio comes from
    ["lightplate", "<style>body{background:#111;color:#fff;margin:0;font:14px sans-serif}button{color:#fff;background:#111;border:1px solid #fff;width:160px;height:30px;font:14px sans-serif;margin:0;padding:0}.t{position:relative;display:inline-block;margin:60px}.pl{position:absolute;left:0;top:0;right:0;bottom:0;background:#eee}button{position:relative;display:block}button:focus-visible{outline:none;top:-2px;box-shadow:0 1px 0 1px #fff}</style><main><div class=\"t\"><div class=\"pl\"></div><button type=\"button\">Go</button></div></main>", ["button pixels 1.16"]],
    // a faint halo on a button lifted onto a rule: the rule that stayed carries no ring, and
    // through a translucent fill it changes nothing focus painted; a strong outline passes
    ["ruleopaque", ruleAbove('#fff', 'outline:none;box-shadow:0 0 2px 0.25px #000'), ["button pixels 2.07"]],
    ["ruleghost", ruleAbove('rgba(255,255,255,.1)', 'outline:none;box-shadow:0 0 2px 0.25px #000'), ["button pixels 2.07"]],
    ["rulestrong", ruleAbove('rgba(255,255,255,.1)', 'outline:2px solid #000;outline-offset:2px'), []],
  ]) {
    const { code, json } = await page(name, html);
    got[name] = { failures: json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy} ${f.ratio}`), unverified: json.focusRingUnverified, code };
    want[name] = { failures, unverified: 0, code: failures.length ? 1 : 0 };
    for (const f of json.focusRingFailures) assert.ok(Math.abs(contrastOf(f.color, f.against) - f.ratio) < 0.06, `${name}: ${JSON.stringify(f)}`);
  }
  assert.deepStrictEqual(got, want);
});

// Pins how the surface behind a lifted control is read. A visibility: visible descendant that
// stays over the strip (positioned against the wrapper, the button lifted by margin) is hidden
// at opacity 0, so the ring over it passes; under visibility: hidden it stayed painted and the
// ring failed at 1.32. A surface that animates behind the strip leaves the ring unverified:
// read from one shot it failed, and scored at 21:1 it passed.
test('a visible child and an animated surface behind the vacated strip', async () => {
  const got = {};
  for (const [name, html] of [['fixedchild2', "<style>body{background:#fff;color:#000;margin:0}.t{position:relative;margin:60px;width:160px;display:flow-root}button{display:block;margin:0;color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif;padding:0}.in{visibility:visible;position:absolute;left:0;top:28px;width:160px;height:2px;z-index:-1;background:#222}button:focus-visible{outline:none;margin-top:-2px;margin-bottom:2px;box-shadow:0 1px 0 1px #000}</style><main><div class=\"t\"><button type=\"button\">Go<span class=\"in\"></span></button></div></main>"], ['anim4', "<style>body{background:#fff;color:#000;margin:0}.t{position:relative;display:inline-block;margin:60px}.pl{position:absolute;left:0;top:0;right:0;bottom:0;background:#222}button{position:relative;display:block;margin:0;color:#000;background:#fff;border:1px solid #000;width:160px;height:30px;font:14px sans-serif}button:focus-visible{outline:none;top:-4px;box-shadow:0 1px 0 1px #000}</style><main><div class=\"t\"><div class=\"pl\"></div><button type=\"button\">Go</button></div></main><script>const s=document.querySelector(\".pl\");let n=0;(function f(){n+=13;const g=n%60;s.style.background=\"rgb(\"+g+\",\"+g+\",\"+g+\")\";requestAnimationFrame(f)})();</script>"]]) {
    const { code, json } = await page(name, html);
    got[name] = { failures: json.focusRingFailures.map((f) => `${f.element} ${f.measuredBy} ${f.ratio}`), unverified: json.focusRingUnverified, code };
  }
  assert.deepStrictEqual(got, { fixedchild2: { failures: [], unverified: 0, code: 0 }, anim4: { failures: [], unverified: 1, code: 0 } });
});
