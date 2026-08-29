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
    const apcaRequired = (size, weight) => {
      const col = Math.min(9, Math.max(1, Math.round(weight / 100)));
      for (const row of FONT_MATRIX) { const min = row[col];
        if (min !== 999 && min !== 777 && size >= min) return row[0]; }
      return null;
    };
    const seen = new Map();
    const apcaSeen = new Map();
    let smallest = Infinity;
    for (const el of document.querySelectorAll('body *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      const size = parseFloat(cs.fontSize); smallest = Math.min(smallest, size);
      const fg = parse(cs.color); const bg = bgOf(el); const r = ratio(fg, bg);
      const bold = parseInt(cs.fontWeight, 10) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const lc = apcaLc(fg, bg);
      const lcNeed = apcaRequired(size, parseInt(cs.fontWeight, 10) || 400);
      if (lcNeed !== null && Math.abs(lc) < lcNeed) {
        const akey = `apca|${el.tagName}.${el.className}|${cs.color}|${bg.r},${bg.g},${bg.b}|${size}`;
        if (!apcaSeen.has(akey)) apcaSeen.set(akey, { element: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''), text: el.textContent.trim().slice(0, 40), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, lc: +lc.toFixed(1), lcRequired: lcNeed, fontSize: size, fontWeight: cs.fontWeight });
      }
      if (r < need) {
        const key = `${el.tagName}.${el.className}|${cs.color}|${bg.r},${bg.g},${bg.b}`;
        if (!seen.has(key)) seen.set(key, { element: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''), text: el.textContent.trim().slice(0, 40), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +r.toFixed(2), required: need, fontSize: size });
      }
    }
    return {
      contrastFailures: [...seen.values()],
      // Advisory only: readability, not conformance. Never gates the exit code.
      apcaWarnings: [...apcaSeen.values()],
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
