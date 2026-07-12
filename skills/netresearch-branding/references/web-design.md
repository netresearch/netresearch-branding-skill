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
  is teal fill, secondary is orange fill (accent — use sparingly, never as
  the dominant action), outline is teal border on transparent. Hover darkens
  the fill (`--color-primary-dark` `#257880` / `--color-accent-dark`
  `#CC3D00`).
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
  background-color: #2F99A4;
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
