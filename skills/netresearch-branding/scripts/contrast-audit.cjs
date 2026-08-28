#!/usr/bin/env node
/**
 * contrast-audit.cjs — measure a rendered page against WCAG AA in headless Chromium.
 *
 * Usage: node contrast-audit.cjs <url-or-file> [--width 1400] [--header "Authorization: Bearer …"]
 * Needs playwright-core (any local install: set PLAYWRIGHT_CORE to its directory, or let
 * `require('playwright-core')` resolve it).
 *
 * Reports, as JSON: every text element below the AA ratio for its size (4.5:1, or 3:1
 * for ≥24 px / ≥18.66 px bold) with foreground, effective background and the measured
 * ratio; whether a skip link, a labelled <nav>, <main> and table captions exist; the
 * smallest rendered font size; SVGs inside text badges without aria-hidden. Hidden
 * elements are skipped. The brand fact this exists for: white on #2F99A4 is 3.38:1 —
 * fine for large text and UI shapes, a fail for 14 px labels; use #15585E for those.
 */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
if (!target) { console.error('usage: contrast-audit.cjs <url-or-file> [--width N] [--header "Name: value"]'); process.exit(2); }
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const width = parseInt(opt('--width', '1400'), 10);
const header = opt('--header', '');
const url = /^https?:/.test(target) ? target : 'file://' + path.resolve(target);
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: true,
    extraHTTPHeaders: header ? { [header.split(':')[0].trim()]: header.split(':').slice(1).join(':').trim() } : {} });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => {
    const parse = (c) => { const m = c.match(/\d+(\.\d+)?/g); return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 } : null; };
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const bgOf = (el) => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c && c.a > 0) return c; el = el.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const ratio = (f, b) => { const l1 = lum(f), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const seen = new Map();
    let smallest = Infinity;
    for (const el of document.querySelectorAll('body *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      const size = parseFloat(cs.fontSize); smallest = Math.min(smallest, size);
      const fg = parse(cs.color); const bg = bgOf(el); const r = ratio(fg, bg);
      const bold = parseInt(cs.fontWeight, 10) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      if (r < need) {
        const key = `${el.tagName}.${el.className}|${cs.color}|${bg.r},${bg.g},${bg.b}`;
        if (!seen.has(key)) seen.set(key, { element: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''), text: el.textContent.trim().slice(0, 40), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +r.toFixed(2), required: need, fontSize: size });
      }
    }
    return {
      contrastFailures: [...seen.values()],
      skipLink: !!document.querySelector('a[href^="#"].skip, a[href="#main"], a[href="#content"], a[href="#inhalt"]'),
      mainLandmark: !!document.querySelector('main'),
      navLabelled: [...document.querySelectorAll('nav')].every((n) => n.getAttribute('aria-label') || n.getAttribute('aria-labelledby')),
      tablesWithCaption: `${document.querySelectorAll('table caption').length} of ${document.querySelectorAll('table').length}`,
      smallestFontPx: +smallest.toFixed(1),
      decorativeSvgWithoutAriaHidden: [...document.querySelectorAll('a svg, button svg, .badge svg')].filter((s) => s.getAttribute('aria-hidden') !== 'true' && !s.getAttribute('role')).length,
      darkScheme: [...document.styleSheets].some((ss) => { try { return [...ss.cssRules].some((r) => /prefers-color-scheme|data-theme/.test(r.cssText)); } catch (e) { return false; } }),
    };
  });
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
  process.exit(result.contrastFailures.length ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
