# Netresearch Web Design Guidelines

Layout, component, and spacing conventions for Netresearch web output. The
canonical, copy-pasteable implementation is `templates/styles.css` (full
component CSS) and `templates/landing-page.html` (full page example) — this
file states which brand decision each component encodes, not the CSS syntax
itself.

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
  (`--color-primary-text` `#15585E` / `--color-accent-text` `#9A2E00`). The
  brand hues `#2F99A4` and `#FF4D00` are **not** used as fills under white
  label text: they give 3.38:1 and 3.33:1, and a 16px/600 label is normal
  text needing 4.5:1.
- **Cards** (`.card`): white background, Raleway title, Open Sans body text.
- **Navigation** (`.navbar`): sticky top, teal active-link state, hamburger
  toggle below 768px.
- **Forms** (`.form-input` etc.): teal focus ring on `:focus`.
- **Hero sections** (`.hero`): teal gradient (`#2F99A4` → `#257880`)
  background, white text, centered.
- **Footer** (`.footer`): anthracite (`#585961`) background per the
  mandatory footer rule in `SKILL.md`.
- **Links** (`a`, `.link-standalone`): teal default, darker teal on hover.

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

It lists every text element below AA for its size, plus skip link, labelled `nav`, `main`,
table captions, the smallest font and decorative SVGs without `aria-hidden`; exit 1 on any
contrast failure. Measured on a branded dashboard 2026-08-28: white on `#2F99A4` at 14 px is
3.38:1 (card heads, table head, active tab), white on `#FF4D00` 3.1:1 — both fixed by moving
filled surfaces to `#15585E` / `#9A2E00` and keeping the bright colours for borders, bars
and large type. Re-measured: zero failures.
