<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
<!-- SPDX-FileCopyrightText: Netresearch DTT GmbH -->

# Netresearch Web Design Guidelines

Layout, component, and spacing conventions for Netresearch web output. The
canonical, copy-pasteable implementation is `templates/styles.css` (full
component CSS) and `templates/landing-page.html` (full page example) — this
file states which brand decision each component encodes, not the CSS syntax
itself.

These templates style standalone Netresearch pages. For manuals hosted on
docs.typo3.org, use [the hosted-manual profile](typo3-docs-branding.md): native
TYPO3 cards and content accents, with the platform's theme and fonts preserved.

## Core Design Principles

### High White Space

Clean, uncluttered layouts that prioritize content and readability. The
spacing scale (`--spacing-xs` 8px … `--spacing-4xl` 96px) is defined once in
`templates/styles.css`.

**Guidelines:**
- Minimum 48px padding around major sections
- Minimum 24px margin between content blocks
- Generous line-height (1.6) for readability
- Never crowd elements - let designs breathe

---

## Component Library

Class definitions live in `templates/styles.css`; a full assembled page is in
`templates/landing-page.html`. The brand decision behind each component:

- **Buttons** (`.btn-primary` / `.btn-secondary` / `.btn-outline`): primary
  is a teal fill `#257880`, secondary an orange fill `#CC3D00` (accent — use
  sparingly, never as the dominant action), outline is a white border on
  transparent for dark surfaces. Hover darkens the fill further
  (`--nr-primary-fill-hover` `#15585E` / `--nr-accent-fill-hover` `#9A2E00` —
  a fill, not a text token: a text token is free to lift on a dark scheme, and
  white over the lifted value fails with nothing able to measure it). The
  brand hues `#2F99A4` and `#FF4D00` are **not** used as fills under white
  label text: they give 3.38:1 and 3.33:1, and a 16px/600 label is normal
  text needing 4.5:1.
- **Cards** (`.card`): white background, Raleway title, Open Sans body text.
- **Navigation** (`.navbar`): sticky top, teal active-link state, hamburger
  toggle below 768px.
- **Forms** (`.form-input` etc.): teal focus ring on `:focus`.
- **Hero sections** (`.hero`): teal gradient (`#257880` → `#15585E`)
  background, white text, centered. Both stops carry white text, so both clear
  4.5:1; the brand `#2F99A4` is 3.38:1 and cannot start this gradient.
- **Footer** (`.footer`): anthracite (`#585961`) background per the
  mandatory footer rule in `SKILL.md`.
- **Links** (`a`, `.link-standalone`): `#15585E` default (8.11:1), `#0A5057` on hover (9.14:1). The brand `#2F99A4` is 3.38:1 and is not a link colour at body size.

Two rules aren't in the shared template — apply them directly:

**Form errors** use the semantic red `#DC3545`, not brand orange, so
validation errors read unambiguously as errors rather than as an accent:

```css
.form-error {
  color: #DC3545;
  font-size: 14px;
}

.form-input.error {
  border-color: #DC3545;
}
```

**External and download links** get a marker so users know what a click
does before they click it:

```css
a[target="_blank"]::after {
  content: ' ↗';
  font-size: 0.9em;
}

a[download]::before {
  content: '⬇ ';
}
```

### Tables

Not covered by `templates/styles.css` either — the third component defined
only here.

```css
.table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--spacing-lg);
  background: #FFFFFF;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.table thead {
  /* #257880, not the brand #2F99A4: white on #2F99A4 is 3.38:1 and a 16px/600
     header cell is normal text, which needs 4.5:1. */
  background-color: #257880;
  color: #FFFFFF;
}

.table th {
  font-family: 'Raleway', sans-serif;
  font-weight: 600;
  text-align: left;
  padding: 16px;
}

.table td {
  font-family: 'Open Sans', sans-serif;
  padding: 12px 16px;
  border-bottom: 1px solid #E5E5E5;
}

.table tbody tr:hover {
  background-color: #F5F5F5;
}

/* Responsive: scroll instead of squeezing columns */
@media (max-width: 768px) {
  .table {
    display: block;
    overflow-x: auto;
  }
}
```

---

## Layout Patterns

`.two-column` and `.three-column` are defined in `templates/styles.css`. One
pattern is unique to this reference:

**Content + Sidebar** — 3fr/1fr grid, stacks to a single column at
`max-width: 1024px`:

```css
.content-sidebar {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: var(--spacing-xxl);
}

@media (max-width: 1024px) {
  .content-sidebar {
    grid-template-columns: 1fr;
  }
}
```

---

## Web Design Checklist

Before launching any web project:

**Layout:**
- [ ] High white space maintained throughout
- [ ] Responsive grid implemented correctly
- [ ] All breakpoints tested (mobile, tablet, desktop)
- [ ] Content max-width appropriate (≤1200px)

**Components:**
- [ ] Buttons follow brand styles (Raleway font, correct colors)
- [ ] Cards have appropriate shadows and hover states
- [ ] Navigation sticky/fixed and accessible
- [ ] Forms styled consistently with validation

**Typography and colors:** see the checklists in `references/typography.md`
and `references/colors.md`.

**Performance:**
- [ ] Images optimized and responsive
- [ ] Fonts loaded efficiently (preload critical)
- [ ] CSS minified for production
- [ ] Animations use transform/opacity (GPU-accelerated)

**Accessibility:**
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels where needed
- [ ] Focus states visible
- [ ] Screen reader tested

---

*Last updated: 2026-07-12*
*Maintained by: Netresearch DTT GmbH*

## Verify: measure the rendered page, not the palette

Contrast is decided by the *rendered* pair — a token that passes on white fails on a tinted
surface, and a 14 px label on a filled teal head is the case that slips through. Run
`scripts/contrast-audit.cjs` (headless Chromium, needs a local `playwright-core`) against the
built page or the live URL:

```bash
node scripts/contrast-audit.cjs public/index.html
node scripts/contrast-audit.cjs https://pages.nrdev.de/<ns>/<project>/ --header "Authorization: Bearer $GITLAB_TOKEN"
```

It lists every text element below AA for its size, every focus indicator below 3:1 (what
changes on focus: the outline, a box-shadow ring or the border, under forced `:focus`
and `:focus-visible`) and every form-control boundary below 3:1 (SC 1.4.11: the border,
a box-shadow ring or the fill; disabled and hidden controls skipped), plus skip link,
labelled `nav`, `main`, table captions, the smallest font, decorative SVGs without
`aria-hidden` and whether the page switches colours under `prefers-color-scheme` or
`data-theme`; exit 1 on any text failure (at rest or under forced `:hover` and
`:focus-visible`), focus-indicator failure or control-boundary failure. Focus indicators
and boundaries are judged first by a colour model of the computed styles, under the
opacity of the control and its ancestors. Where that model passes a ring or a boundary,
the control is judged again on screenshots, unfocused and focused for a ring, so a blur,
a fractional spread, a ring layer hidden under another, an ancestor's `overflow` clip, a
gradient fill, `filter`, `mix-blend-mode` and a ring on a fully rounded pill are
measured as painted. The pixels only add failures (`measuredBy: "pixels"`); a model failure
stands (`measuredBy: "model"`). A control inside a scroll container is scrolled into view
for the screenshots, like one outside the window, and scrolled back. A transform that
applies only on focus (a 1px lift, a scale) is pinned to its unfocused value for the
focused screenshot where the focused box still overlaps the unfocused one by half (a
skip link that a transform brings into view is shot where focus shows it). A lift the
pin cannot undo (an ancestor's `transform`, `top`, a margin) is registered: where focus
moves the box by whole pixels at the same size and the two boxes overlap by half, each
focused pixel is compared with the unfocused pixel it moved from and with the one in
place, so neither the moved border nor a neighbour that stayed counts as a ring. A pixel
outside the focused box (over the strip the control vacated, or over a rule it moved onto)
is scored against the lower of the pixel it moved from and the surface behind the control,
read from shots with the control made transparent, one before the focused shot and three
after (a ring over a surface behind the strip close to its own colour, a dark plate under
a black ring or a light one under a white ring, never visible, fails: a known false
failure). A pixel inside the focused box over a surface the control moved onto is not
scored, because the screenshots cannot tell whether that surface shows through the
control (a translucent fill, a blend mode, an ancestor's `filter`); where the ring would
pass with those pixels, the control is unverified. A surface that moves with the control
and keeps its colour (a card that lifts it) is read as before; a card that also changes
its background on `:focus-within` counts as another surface. Pixels that change between the
three unfocused screenshots (an animated neighbour; for a skip link, looked for where
the focused link shows) are never part of a ring. A control the model
passed is counted in `focusRingUnverified` or `controlBoundaryUnverified` and does not
fail when another element covers it (an image, canvas, iframe, a `::before` or a
`backdrop-filter` covers; an empty transparent overlay does not), when an ancestor on its
containing-block chain still clips it (`overflow`, `contain: paint`, `clip-path`,
`content-visibility`), when its focused box lies even partly outside the viewport (a
skip link waiting outside it is measured where focus shows it), when it is rotated
(`transform` or `rotate`), skewed or transformed in 3D, when an ancestor's focus
transform resizes it or moves it by a fraction of a pixel (a card that scales on
`:focus-within`, also with a strong ring), when its own pixels move between the
screenshots (a debounced scroll handler), when an animated neighbour changes along as
much of it as a ring must cover (a moving stripe; a small spinner does not count; an
animation that shows the same frame in all three unfocused screenshots can still pass),
or when its ring fails only where such a neighbour hides it and the hidden pixels, taken
at 21:1, would complete it.
Icons and images inside a control are hidden to find the pixels focus changes, and shown
again to score them; a pixel counts only when it changed in both, so an inset ring over a
photo is measured against the photo and one painted under an opaque image fails at 1:1.
The browser's own ring, a focus change without outline, ring or border (counted in
`focusWithoutRing`) and hidden controls are not judged on pixels.
An inset ring is read against the fill it replaced, not the fill beside it: where focus also
changes a gradient or image fill, a weak inset ring passes
([#128](https://github.com/netresearch/netresearch-branding-skill/issues/128)).
Icons and other graphics are not measured.

TLS certificates are verified for the page and every request it makes; an invalid
certificate aborts that connection before any request, and with it any `--header` value, is
sent. A page that fails to load exits 2, a stylesheet or script that fails exits 1, and a
failed image or font is listed in `failedRequests` without changing the exit code. For a
local development server with a self-signed certificate, `--insecure` turns verification
off. It refuses to run together with `--header`.

The `--header` value goes only to the target's own origin (scheme, host and port): not to
fonts, stylesheets or images from other origins, and not across a redirect to another origin.
With an `http://` target, `--header` is refused unless the host is `localhost`, `127.0.0.1`
or `[::1]`.

`apcaWarnings` reports the same elements against APCA (Lc, and the value APCA's font table
asks for at that size and weight). Those are **advisory**: they never change the exit code,
and an APCA pass never waives a WCAG failure. WCAG 2.2 AA is the gate; see the `typo3-a11y`
skill for the policy. A page can be WCAG-clean and still carry APCA warnings — the shipped
`templates/landing-page.html` does, because APCA asks Lc 90 of 16px/400 body text and the
anthracite `#585961` on white reaches Lc 84.

Measured on a branded dashboard 2026-08-28: white on `#2F99A4` at 14 px is
3.38:1 (card heads, table head, active tab), white on `#FF4D00` 3.33:1 — both fixed by moving
filled surfaces to `#15585E` / `#9A2E00` and keeping the bright colours for borders, bars
and large type. Re-measured: zero failures.
