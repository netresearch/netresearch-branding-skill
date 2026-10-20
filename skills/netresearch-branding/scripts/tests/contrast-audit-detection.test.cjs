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
  for (const el of ['option', 'p.dt', 'div.dc', 'span.m']) assert.ok(text.includes(el), `${el} must be measured at rest: ${JSON.stringify(text)}`);
  assert.ok(!json.contrastFailures.some((f) => f.text === 'Wait!'), `the exit-intent popup must stay closed: ${JSON.stringify(text)}`);
  assert.deepStrictEqual(json.stateFailures.filter((f) => f.element.startsWith('a.card')).map((f) => `${f.state} ${f.element}`).sort(), ['hover a.card span.m']);
  assert.ok(!json.stateFailures.some((f) => f.element.startsWith('main')), `a demo inside the focusable <main> is exempt: ${JSON.stringify(json.stateFailures)}`);
  assert.strictEqual(code, 1);
});

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

// Shapes a page author meets: each of these must fail, and the class names which.
test('weak indicators in their common shapes fail', async () => {
  const { code, json } = await run(fixture('weakshapes',
    'button{color:#000;background:#fff;border:1px solid #000}'
    + 'a.fo:focus{outline:2px solid #eee}' // written under :focus, not :focus-visible
    + 'button.tf:focus-visible{outline:none;box-shadow:rgba(0,0,0,0) 0 0 0 0,#eee 0 0 0 3px}' // transparent first layer
    + 'button.ot:focus-visible{outline:2px solid transparent;box-shadow:0 0 0 3px #eee}' // transparent outline, shadow ring
    + 'a.tr:focus-visible{outline:3px solid rgba(0,0,0,.2);outline-offset:2px}' // translucent: renders #ccc, 1.6:1
    + 'a.ok:focus-visible{outline:3px solid oklch(0.95 0 0)}' // a non-rgb colour
    + '.grey{background:#ccc;padding:8px}input.tb{border:2px solid rgba(0,0,0,.5);background:#fff}' // border over the white fill: 2.5:1 on #ccc
    + 'input.af{border:1px solid #000}input.af:focus-visible{outline:2px solid #eee}' // focused on load (autofocus)
    + 'a.fl{display:inline}a.fl:focus-visible{outline:2px solid #eee}' // only floated content: a 0x0 box
    + 'button.bc:focus-visible{outline:none;border-color:#eee}' // focus shown by the border alone
    + 'button.tb2{border:2px solid #000}button.tb2:focus-visible{outline:none;border-color:rgba(0,0,0,.5)}' // over the white fill: 2.5:1 on #ccc
    + 'a.off{outline:2px solid #e8e8e8}a.off:focus-visible{outline-offset:4px}' // a weak outline that only moves out
    + 'button.boff{outline:2px solid #eee;outline-offset:-8px}button.boff:focus-visible{outline-offset:2px}', // moved from inside to outside
    '<p><a class="fo" href="#a">One</a> <a class="tr" href="#b">Two</a> <a class="ok" href="#c">Three</a></p>'
    + '<button type="button" class="tf">Go</button> <button type="button" class="ot">Go</button>'
    + '<div class="grey"><label>Name <input class="tb"></label> <button type="button" class="tb2">Go</button></div>'
    + '<label>Search <input class="af" autofocus></label> <button type="button" class="bc">Go</button>'
    + '<p><a class="fl" href="#f"><span style="float:left">Floated</span></a></p>'
    + '<p><a class="off" href="#o">Moves</a> <button type="button" class="boff">Moves</button></p>'));
  assert.deepStrictEqual(json.focusRingFailures.map((f) => f.element).sort(),
    ['a.fl', 'a.fo', 'a.off', 'a.ok', 'a.tr', 'button.bc', 'button.boff', 'button.ot', 'button.tb2', 'button.tf', 'input.af']);
  assert.deepStrictEqual(json.controlBoundaryFailures.map((f) => f.element), ['input.tb']);
  assert.strictEqual(code, 1);
});

// Each of these passes, or is not a focus state a user can reach.
test('strong, unchanged, unreachable and hidden indicators do not fail', async () => {
  const { code, json } = await run(fixture('fineshapes',
    'button{color:#fff;background:#444;border:0}'
    + 'a.tw:focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px #1d4ed8}' // ring offset: white, then a blue ring
    + '.dark{background:#222;padding:8px}'
    + 'button.inset{box-shadow:inset 0 1px 2px rgba(0,0,0,.1)}button.inset:focus-visible{box-shadow:inset 0 1px 2px rgba(0,0,0,.1),0 0 0 3px #fff}'
    + 'a.decor{box-shadow:0 1px 2px rgba(0,0,0,.08)}a.decor:focus-visible{outline:none;text-decoration-thickness:3px}' // permanent shadow is no ring
    + 'button.ir{background:#222}button.ir:focus-visible{outline:2px solid #fff;outline-offset:-4px}' // inset outline: white on #222
    + 'button.dis:focus-visible{outline:2px solid #eee}'
    + '.mid{background:#595959;padding:8px}input.fill{border:0;background:#fff}' // no border, the fill carries the boundary
    + 'input.faint{border:1px solid #eee;background:#fff}'
    + 'a.perm{outline:1px solid #eee}' // a permanent outline is not a focus indicator
    + 'a.pr{box-shadow:0 0 0 3px #eee}a.pr:focus-visible{outline:none;text-decoration-thickness:3px}' // nor a permanent ring
    + 'button.ins{background:#222}button.ins:focus-visible{outline:none;box-shadow:inset 0 0 0 3px #fff}' // inset ring: white on #222
    + 'button.gl:focus-visible{outline:none;box-shadow:0 0 8px #eee}' // a blur glow without spread is no ring
    // a custom switch: a transparent input over a track its parent draws
    + '.sw{position:relative;display:inline-block;width:40px;height:20px;background:#15585E;border-radius:10px}'
    // (transparent and borderless, its "fill" is the track itself: 1.00:1 if it were judged)
    + '.sw input{appearance:none;position:absolute;inset:0;margin:0;opacity:0;background:transparent;border:0}'
    // the usual visually hidden input: its white fill alone is 1.00:1 on white
    + 'input.sr{position:absolute;width:1px;height:1px;padding:0;border:0;background:#fff;overflow:hidden;clip-path:inset(50%)}',
    '<p><a class="tw" href="#a">Ring</a> <a class="decor" href="#b">Card link</a></p>'
    + '<div class="dark"><button type="button" class="inset">Go</button></div>'
    + '<button type="button" class="ir">Inset</button> <button type="button" class="dis" disabled>Off</button>'
    + '<div class="mid"><label style="color:#fff">Name <input class="fill"></label></div>'
    + '<div style="display:none"><input class="faint"></div><dialog><input class="faint"></dialog>'
    + '<div style="visibility:hidden"><input class="faint"></div><fieldset disabled><input class="faint"></fieldset>'
    + '<p><a class="perm" href="#p">Outlined</a> <a class="pr" href="#q">Ringed</a> <button type="button" class="ins">Inset</button></p>'
    + '<label>Hidden <input class="sr"></label>'
    + '<p><button type="button" class="gl">Glow</button> <label>Notify <span class="sw"><input type="checkbox"></span></label></p>'));
  assert.deepStrictEqual(json.focusRingFailures, []);
  assert.deepStrictEqual(json.controlBoundaryFailures, []);
  assert.ok(json.focusWithoutRing >= 1, `the card link shows focus without a ring and must be counted, got ${json.focusWithoutRing}`);
  assert.strictEqual(code, 0, `expected a pass, got exit ${code}`);
});
