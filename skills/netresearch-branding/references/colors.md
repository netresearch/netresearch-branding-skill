# Netresearch Brand Colors Reference

Complete color palette with technical specifications and usage guidelines.

## Primary Brand Colors

### Turquoise (Primary)
**Technical Specifications:**
- **Hex:** `#2F99A4`
- **RGB:** `rgb(47, 153, 164)`
- **CMYK:** `C71 M7 Y17 K36`
- **Pantone:** 7709 C (approximate)
- **NCS:** S 3040-B30G

**Usage:**
- Primary brand color for all digital and print materials
- Main CTA buttons and interactive elements
- Headers and key visual elements
- Links in default state
- Primary navigation highlights
- Brand identity elements

**Contrast Ratios (WCAG, measured):**
- On white background: 3.38:1 (large text & UI components only — fails AA for normal text)
- On #F5F5F5: 3.1:1 (large text & UI only)
- White text on turquoise: 3.38:1 (large text & UI only — **fails AA for normal text**, AAA needs 4.5:1 large / 7:1 normal)

> Contrast is symmetric: `#2F99A4` on white and white on `#2F99A4` are the **same** 3.38:1. For normal body text on a teal fill (or teal text at body size), use a darker teal such as `#15585E` (8.1:1 on white) instead.

**Web Implementation:**
```css
:root {
  --color-primary: #2F99A4;
  --color-primary-rgb: 47, 153, 164;
}

.btn-primary {
  background-color: var(--color-primary);
  color: #FFFFFF;
}

.link-primary {
  color: var(--color-primary);
}
```

---

### Orange (Accent)
**Technical Specifications:**
- **Hex:** `#FF4D00`
- **RGB:** `rgb(255, 77, 0)`
- **CMYK:** `C0 M70 Y100 K0`
- **Pantone:** 172 C (approximate)
- **NCS:** S 1080-Y60R

**Usage:**
- Accent color for emphasis and highlights
- Secondary CTA buttons
- Important notifications and alerts
- Hover states on primary elements
- Call-out boxes and highlights
- Limited use - accent only, not dominant

**Contrast Ratios (WCAG, measured):**
- On white background: 3.33:1 (large text & UI only)
- On #F5F5F5: 3.05:1 (large text & UI only)
- White text on orange: 3.33:1 (large text & UI only — same value, contrast is symmetric)

**Web Implementation:**
```css
:root {
  --color-accent: #FF4D00;
  --color-accent-rgb: 255, 77, 0;
}

.btn-secondary {
  background-color: var(--color-accent);
  color: #FFFFFF;
}

.highlight {
  border-left: 4px solid var(--color-accent);
}
```

---

## Neutral Colors

### Anthracite (Text Primary)
**Technical Specifications:**
- **Hex:** `#585961`
- **RGB:** `rgb(88, 89, 97)`
- **CMYK:** C9 M2 Y0 K62`
- **NCS:** S 5502-B

**Usage:**
- Primary text color for body copy
- Headlines and subheadings
- Navigation text
- Form labels
- Default icon color

**Contrast Ratios (WCAG, measured):**
- On white background: 6.96:1 (Meets AA for all text — **just below the 7:1 AAA threshold**)
- On #F5F5F5: 6.39:1 (Meets AA for all text; fails AAA)

> For AAA-grade body text, darken to `#4D4F57` (8.2:1 on white) or use `#25272D` (≈15:1).

**Web Implementation:**
```css
:root {
  --color-text-primary: #585961;
}

body, p, h1, h2, h3 {
  color: var(--color-text-primary);
}
```

---

### Light Grey (Backgrounds)
**Technical Specifications:**
- **Hex:** `#CCCDCC`
- **RGB:** `rgb(204, 205, 204)`
- **CMYK:** C0 M0 Y0 K20`
- **NCS:** S 2000-N

**Usage:**
- Background sections and cards
- Subtle borders and dividers
- Disabled states
- Alternating table rows
- Input field borders

**Contrast Note:**
- Not suitable for text on white background
- Use for backgrounds and UI elements only

**Web Implementation:**
```css
:root {
  --color-background-light: #CCCDCC;
  --color-border-light: #CCCDCC;
}

.card {
  background-color: #F5F5F5;
  border: 1px solid var(--color-border-light);
}
```

---

### White (Background)
**Technical Specifications:**
- **Hex:** `#FFFFFF`
- **RGB:** `rgb(255, 255, 255)`

**Usage:**
- Primary background color
- Text on dark backgrounds
- Card backgrounds
- Clean, spacious layouts

---

## Color Combinations

### Approved Combinations

**Primary Palette:**
```css
/* Turquoise on white - Primary brand */
.combination-1 {
  background: #FFFFFF;
  color: #2F99A4;
}

/* White text on turquoise - High impact */
.combination-2 {
  background: #2F99A4;
  color: #FFFFFF;
}

/* Orange accent with turquoise */
.combination-3 {
  background: #2F99A4;
  border-color: #FF4D00;
  color: #FFFFFF;
}
```

**Text Combinations:**
```css
/* Body text on white - Standard */
.text-standard {
  background: #FFFFFF;
  color: #585961;
}

/* Body text on light grey - Sections */
.text-section {
  background: #F5F5F5;
  color: #585961;
}
```

### Avoid These Combinations

❌ **Never Use:**
- Orange on turquoise (poor contrast)
- Light grey text on white (fails WCAG)
- Turquoise text smaller than 24px (18.66px bold) on white (AA compliance)
- Orange text on white for small text (fails AA)

---

## Accessibility Guidelines

### WCAG AA Compliance

**Minimum Contrast Ratios:**
- **Normal text (< 24px, or < 18.66px bold):** 4.5:1
- **Large text (≥ 24px, or ≥ 18.66px bold):** 3:1
- **UI components:** 3:1

> 18px is *not* the large-text threshold. WCAG 1.4.3 defines large text as 18pt
> (= 24 CSS px) normal or 14pt (= 18.66 CSS px) bold, and a 16px/600 button
> label is therefore normal text needing 4.5:1.

**Approved Text Combinations:**

✅ **Pass AA for All Text Sizes** (normal & large):
- Anthracite (#585961) on white: 6.96:1 ✓ (AA only — **not** AAA)
- Anthracite (#585961) on #F5F5F5: 6.39:1 ✓ (AA only)

✅ **Pass AA for Large Text & UI Only** (≥18.66px bold / ≥24px; fail AA for normal text):
- Turquoise (#2F99A4) on white: 3.38:1
- White on turquoise (#2F99A4): 3.38:1 (same — symmetric)
- Orange (#FF4D00) on white: 3.33:1
- White on orange (#FF4D00): 3.33:1

✅ **AAA-grade (≥7:1 normal / ≥4.5:1 large)** — use these for body text:
- Anthracite-dark (#4D4F57) on white: 8.2:1 ✓
- Teal-dark (#15585E) on white: 8.1:1 ✓ (7.4:1 on #F5F5F5)
- Accent-dark (#9A2E00) on white: 7.6:1 ✓ (7.0:1 on #F5F5F5)
- Ink (#25272D) on white: ~15:1 ✓

✅ **Fills that carry white text** — a filled button or badge is text on a
background, and #2F99A4 gives that text 3.38:1:
- White on teal-fill (#257880): 5.2:1 ✓
- White on teal-dark (#15585E): 8.1:1 ✓

❌ **Fail AA (Do Not Use for text):**
- Light grey (#CCCDCC) on white: 1.59:1 ✗

---

## Usage Guidelines by Context

### Compliance vs. readability

Two independent goals, in this order:

1. **Compliance.** Every text-bearing combination MUST meet WCAG 2.2 AA. Where
   EN 301 549 applies, WCAG 2.1 AA remains the referenced legal baseline; the
   contrast requirements are identical in both.
2. **Perceptual readability.** APCA MAY be measured in addition, especially for
   saturated colours, dark mode, light-on-dark text and small or thin type. An
   APCA pass MUST NOT waive a WCAG failure.

Personal visual preference is not an accessibility test — see the
`typo3-a11y` skill for the full policy and the reasoning.

### Websites

Pick the token by role, not by name. Turquoise and orange are the brand at
display sizes and on non-text elements; below 24px they need their dark
variants, and a turquoise fill under white text needs one too.

| Role | Token | Why |
|---|---|---|
| Display headings (≥24px, or ≥18.66px bold) | `#2F99A4` | 3.38:1 clears the 3:1 large-text threshold |
| Links, small labels, eyebrows, badges | `#15585E` | 8.1:1 — `#2F99A4` is 3.38:1 and fails AA here |
| Filled buttons carrying white text | `#257880` | white on `#2F99A4` is 3.38:1 |
| Borders, rules, icons, chart series | `#2F99A4` | non-text, 3:1 applies |
| Accent emphasis in text | `#9A2E00` | 7.6:1 — `#FF4D00` is 3.33:1 |
| Accent as a fill or marker | `#FF4D00` | non-text |
| Body text | `#585961` | 6.96:1 |

- **Background:** White (#FFFFFF) or subtle off-white (#F5F5F5)
- **Accent:** sparingly, for emphasis — never as a surface
- **High white space:** Let colors breathe

Measured on six Netresearch sites: following "turquoise for links and CTAs"
literally produced 243 WCAG AA contrast failures, none of which a markup-level
check can see. See "Verifying contrast" below.

### Dark backgrounds

The dark variants above are for light backgrounds. On a dark surface they go the
wrong way: `#15585E` is *less* legible there, not more. Lift the same hues
instead. The link and accent values are the ones already verified against
netresearch.de — see "WCAG-AAA contrast variants" below.

| Role | Token | Measured |
|---|---|---|
| Body text | `#E8EDEF` | 15.1:1 on `#14181B` |
| Links, small labels, headings | `#5FC6D2` | 8.9:1 on `#14181B`, 5.7:1 on a lifted `#363a40` |
| Brand accents | `#7FD6E0` | 6.9:1 on `#363a40` |
| Fills carrying white text | `#1B6C74` | 6.1:1 |
| Accent text on its own tint | `#FF7A45` | 4.8:1 on `#4a2d26` (`#FF4D00` is 3.7:1 there) |
| Borders, rules, chart series | `#2F99A4` | non-text, 3:1 applies |

Two traps this table exists for:

- **The brand turquoise passes as text on a deep surface and fails on a lifted
  one.** `#2F99A4` reaches 4.9:1 on `#1a1d2e` but only 3.38:1 on `#363a40` — the
  same colour, the same page, one hovered row apart. Use `#5FC6D2` for text and
  keep `#2F99A4` for the non-text roles.
- **A translucent tint has no contrast value of its own.**
  `rgba(47, 153, 164, .18)` composites against whatever is behind it, so the
  pair changes with the parent and no static tool can decide it. Give badges and
  pills an opaque background.

### Verifying contrast

Contrast is not decidable from markup, or from a stylesheet read in isolation.
It needs resolved CSS and a compositing model, so it belongs in a browser:

- Run `axe-core` against the **built** output, in a real browser, at the
  conformance level the page claims — `wcag2a, wcag2aa, wcag21a, wcag21aa`.
- Run it in **both colour schemes**. A dark palette is a separate set of colour
  pairs; a light-only audit says nothing about it.
- Serve the output over HTTP under its real base path, and fail on any request
  that does not succeed. A page whose stylesheet 404s has no contrast failures
  at all and passes for the wrong reason.
- Do not trust a static CSS checker on a dark theme: it composites translucent
  colours over white, reporting failures that are not there and missing ones
  that are.

### Social Media
- **Header images:** Turquoise primary with orange accents
- **Profile elements:** Turquoise logo on white
- **Post graphics:** Maximum 2 brand colors per graphic

### Documents
- **Headers:** Turquoise or anthracite
- **Highlights:** Orange for key information
- **Body text:** Anthracite
- **Backgrounds:** White primary, light grey for emphasis

### Presentations
- **Title slides:** Turquoise background with white text
- **Content slides:** White background with turquoise accents
- **Emphasis:** Orange for key points

---

## CSS Custom Properties (Complete Set)

```css
:root {
  /* Primary Colors */
  --color-primary: #2F99A4;
  --color-primary-rgb: 47, 153, 164;
  --color-primary-light: rgba(47, 153, 164, 0.1);
  --color-primary-dark: #257880;

  /* Accent Colors */
  --color-accent: #FF4D00;
  --color-accent-rgb: 255, 77, 0;
  --color-accent-light: rgba(255, 77, 0, 0.1);
  --color-accent-dark: #CC3D00;

  /* Neutral Colors */
  --color-text-primary: #585961;
  --color-text-secondary: #8A8B93;
  --color-background: #FFFFFF;
  --color-background-alt: #F5F5F5;
  --color-border: #CCCDCC;
  --color-border-light: #E5E5E5;

  /* Semantic Colors */
  --color-success: #28A745;
  --color-warning: #FFC107;
  --color-error: #DC3545;
  --color-info: var(--color-primary);
}
```

---

## Sass/SCSS Variables

```scss
// Primary Colors
$color-primary: #2F99A4;
$color-accent: #FF4D00;

// Neutral Colors
$color-anthracite: #585961;
$color-light-grey: #CCCDCC;
$color-white: #FFFFFF;

// Backgrounds
$color-bg-primary: $color-white;
$color-bg-secondary: #F5F5F5;

// Text
$color-text-primary: $color-anthracite;
$color-text-secondary: lighten($color-anthracite, 15%);

// Borders
$color-border: $color-light-grey;
$color-border-light: #E5E5E5;
```

---

## Color Testing Checklist

Before deploying any brand materials:

- [ ] All text meets WCAG AA contrast requirements
- [ ] Turquoise is primary, orange is accent only
- [ ] No unapproved color combinations used
- [ ] Colors match exact hex values
- [ ] High white space maintained
- [ ] Tested on multiple displays for color accuracy
- [ ] Print materials use CMYK values
- [ ] Digital materials use RGB/Hex values

---

*Last updated: 2026-06-23*
*Maintained by: Netresearch DTT GmbH*

## WCAG-AAA contrast variants (verified against netresearch.de main.css)

The bright primary `#2F99A4` is for accents and non-text use — it does not reach AAA on white. Verified working variants:

- **Large headings on white**: `#0A6E77` (darker teal, ~6:1 = AAA-large only).
- **AAA body/link text on white**: darken further to `#0A5057` (≥9:1).
- **AAA dark theme** (all ≥7:1 on background `#14181B`): text `#E8EDEF`, links `#5FC6D2`, brand accents `#7FD6E0`.
- Neutrals in live use: text `#585961`, near-black `#090909`; light grays `#F7F7F7`, `#D8D8D8`, `#CCCDCC`.

The wordmark is lowercase "netresearch"; never substitute a red/orange primary (an early page wrongly used GitLab's `#E24329`).
