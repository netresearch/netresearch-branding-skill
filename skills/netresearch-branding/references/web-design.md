<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
<!-- SPDX-FileCopyrightText: Netresearch DTT GmbH -->

# Netresearch Web Design Guidelines

Layout, component, and spacing conventions for Netresearch web output. The
canonical, copy-pasteable implementation is `templates/styles.css` (full
component CSS) and `templates/landing-page.html` (full page example). This
file states which brand decision each component encodes, not the CSS syntax
itself.

## Design treatment

Netresearch output is built in a contemporary treatment by default: the brand
colours, fonts, logo and footer stay exactly as specified, and the way they are
put together follows current product design. Nobody has to ask for "modern";
the dated look (4px boxes, centred everything, hover jumps, heavy grey drop
shadows, teal fills under small white text) is the thing to avoid.

**One bold surface per page.** The petrol gradient
`#257880 → #15585E → #0A5057` carries exactly one area: the hero, the brand panel of a split layout,
or the header band of an app page. Every stop carries white text at 5.15:1 or
more; the brand `#2F99A4` cannot start the gradient. The nested rounded squares
of `--nr-motif` echo the frame of the [n] mark at 14% white; they are
decoration, never a substitute for the logo, and the logo itself is never
recoloured or placed on the gradient.

**Depth through hairlines, not shadows.** A raised element reads through a 1px
`--nr-border-light` border first; `--shadow-sm` / `--shadow-md` add soft,
layered depth. Radii: 10px (`--radius-md`) for buttons and inputs, 16px
(`--radius-lg`) for cards and panels, 24px (`--radius-xl`) for hero panels and
dialogs, pills for badges and segmented controls. Hover changes border, shadow
or tint, never position.

**Hierarchy through type and alignment.** Headings use `--nr-ink` (`#25272D`,
14.9:1) and sit left-aligned under an uppercase eyebrow (`.eyebrow`). The
eyebrow's orange dot is the accent in its intended role: a small marker.
Centre only short, single-purpose blocks (a status page, an empty state).

**State in form as well as colour.** Status is a pill with a dot and a word
(`.badge-info|success|warning|danger|accent`), metrics are tiles with tabular
figures (`.stat`), messages are notices with an icon and a coloured left edge
(`.notice-*`). Every tint is opaque and its text pair is measured; an `rgba()`
tint has no ratio of its own because it composites over whatever is behind it.

**Controls that read as controls.** Inputs and buttons are 48px high with a
3:1 boundary (`--nr-border-strong`). Focus is a visible ring (`--nr-ring`),
not a colour change. Checkboxes and radios are drawn (`.form-check`) so the
box keeps its 3:1 edge in both schemes. Two to four mutually exclusive views
(language, period, list/grid) use a segmented control (`.segmented`), not a
row of links.

**Real structure only.** Numbered steps (`.steps`) appear only for a real
sequence; the eyebrow names a section's subject; badges carry a state the
reader needs. Decoration that encodes nothing is left out.

**Both schemes.** Every token has a dark value (see `references/colors.md`).
Honour `prefers-color-scheme` and an explicit `data-theme` attribute; text
roles lift on dark, non-text roles keep the brand hue.

## Core Design Principles

### High White Space

Clean, uncluttered layouts that prioritize content and readability. The
spacing scale (`--spacing-xs` 8px … `--spacing-4xl` 96px) is defined once in
`templates/styles.css`.

**Guidelines:**
- Minimum 48px padding around major sections
- Minimum 24px margin between content blocks
- Generous line-height (1.6) for readability; running text at most ~70 characters wide
- Never crowd elements; let designs breathe

---

## Component Library

Class definitions live in `templates/styles.css`; a full assembled page is in
`templates/landing-page.html`, every component on its own in
`examples/components.html`. The brand decision behind each component:

- **Buttons** (`.btn-primary` / `.btn-secondary` / `.btn-tonal` /
  `.btn-ghost` / `.btn-outline`): primary is a teal fill `#257880`; secondary
  an orange fill `#CC3D00` (accent, use sparingly, never as the dominant
  action); tonal is the quiet second action on light surfaces (white with a
  `#2F99A4` edge and `#15585E` label); ghost has no box until hover; outline is
  a white border on transparent for the gradient only. Hover darkens the fill
  (`--nr-primary-fill-hover` `#15585E` / `--nr-accent-fill-hover` `#9A2E00`, a
  fill, not a text token: a text token is free to lift on a dark scheme, and
  white over the lifted value fails with nothing able to measure it). The brand
  hues `#2F99A4` and `#FF4D00` are **not** used as fills under white label
  text: they give 3.38:1 and 3.33:1, and a 16px/600 label is normal text
  needing 4.5:1.
- **Cards** (`.card`, `.card-interactive`): white surface, hairline border,
  16px radius, Raleway title. `.feature-icon` puts a stroke icon on a teal tint
  plate above the title.
- **Navigation** (`.navbar`, `.navbar-brand`, `.navbar-wordmark`): sticky,
  white with a hairline bottom border; logo plus product name as one link;
  links are pills with a tint for the active page; hamburger below 768px.
- **Hero** (`.hero`, `.hero-split`, `.hero-panel`, `.hero-facts`): the
  gradient surface with the motif, left-aligned, sized to its content (no
  `min-height`). The split variant puts a white panel (facts, a form, a
  preview) beside the message; fact chips are border-only so the gradient stays
  the measured background behind their text.
- **Badges** (`.badge-*`): opaque tints, measured: `#15585E` on `#E6F2F3`
  7.09:1, `#9A2E00` on `#FFF0E8` 6.83:1, `#1E6F31` on `#E9F6EC` 5.59:1,
  `#6E4C00` on `#FFF6DB` 7.21:1, `#A32330` on `#FCEBED` 6.42:1.
- **Metrics** (`.stat-grid`, `.stat`): label, value in Raleway with tabular
  figures, optional meta line. Use them when the numbers are the point of the
  page.
- **Notices** (`.notice`, `-success`, `-warning`, `-danger`): icon, bold
  title, coloured 4px left edge.
- **Tables** (`.table-wrap`, `.table`): hairline frame with 16px radius,
  small uppercase header on `#F5F5F5`, row hover tint, `.num` for right-aligned
  tabular figures. The wrapper scrolls horizontally on small screens.
- **Forms** (`.form-input`, `.form-select`, `.form-textarea`, `.form-check`,
  `.form-help`, `.form-error`): 48px, 3:1 border, focus ring, drawn
  checkbox/radio. Errors use `--nr-danger-text` `#A32330` (6.42:1 on its tint),
  never brand orange, so they read as errors.
- **Segmented control** (`.segmented`): pill track, selected item as a white
  pill with `#15585E` label; mark it with `aria-current`, `aria-pressed` or
  `aria-selected`.
- **Split layout** (`.split-layout`, `.split-panel`, `.split-main`, `.steps`):
  sign-in, request and upload screens. Brand panel with the real steps of the
  process on the left, the task on plain white on the right; stacks below
  1024px.
- **App page** (`.page-band`, `.page-body`): a short gradient header band with
  eyebrow and title; the first content block overlaps it by 72px.
- **Dialog** (`.dialog`): 24px radius, blurred dark backdrop.
- **Footer** (`.footer`): anthracite (`#585961`) background per the mandatory
  footer rule in `SKILL.md`; company name and link to netresearch.de in
  `.footer-bottom`.
- **Links** (`a`, `.link-standalone`): `#15585E` default (8.11:1), `#0A5057` on
  hover (9.14:1), underlined in running text. The brand `#2F99A4` is 3.38:1 and
  is not a link colour at body size.

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

---

## Layout Patterns

`.two-column`, `.three-column`, `.hero-split`, `.split-layout`, `.stack` and
`.cluster` are defined in `templates/styles.css`. One pattern is unique to
this reference:

**Content + Sidebar**: 3fr/1fr grid, stacks to a single column at
`max-width: 1024px`:

```css
.content-sidebar {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
  gap: var(--spacing-xxl);
}

@media (max-width: 1024px) {
  .content-sidebar {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

---

## Web Design Checklist

Before launching any web project:

**Treatment:**
- [ ] Exactly one gradient surface; everything else white or `#F5F5F5`
- [ ] Cards and panels: hairline border, soft shadow, 16px radius; no hover jumps
- [ ] Headings left-aligned in `--nr-ink`; eyebrows only where they name a section
- [ ] States shown as badges, metrics as tiles, messages as notices

**Layout:**
- [ ] High white space maintained throughout
- [ ] Responsive grid implemented correctly
- [ ] All breakpoints tested (mobile, tablet, desktop)
- [ ] Content max-width appropriate (≤1200px)

**Components:**
- [ ] Buttons follow brand styles (Raleway, teal fill, 48px)
- [ ] Navigation sticky and accessible
- [ ] Forms with 3:1 borders, focus ring, drawn checkboxes and inline errors

**Typography and colors:** see the checklists in `references/typography.md`
and `references/colors.md`.

**Performance:**
- [ ] Images optimized and responsive
- [ ] Fonts loaded efficiently (preload critical)
- [ ] CSS minified for production
- [ ] Animations use transform/opacity and respect `prefers-reduced-motion`

**Accessibility:**
- [ ] All interactive elements keyboard accessible
- [ ] Skip link, labelled `nav`, one `main`
- [ ] Focus states visible
- [ ] Both colour schemes audited

---

*Last updated: 2026-10-13*
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
contrast failure.

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
