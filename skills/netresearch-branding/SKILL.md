---
# SPDX-License-Identifier: CC-BY-SA-4.0
# SPDX-FileCopyrightText: Netresearch DTT GmbH
name: netresearch-branding
description: "Use when working with ANY Netresearch visual output: branded pages, dashboards, HTML reports, TYPO3 manuals on docs.typo3.org, extension icons, README badges, or CSS theming. Select the hosted-manual or standalone-page profile before applying logo, typography, color and footer requirements."
license: "(MIT AND CC-BY-SA-4.0)"
metadata:
  version: "2.13.0"
  repository: "https://github.com/netresearch/netresearch-branding-skill"
  author: "Netresearch DTT GmbH"
---

# Netresearch Brand Guidelines (Strict)

Apply Netresearch brand identity to web outputs, documentation, and TYPO3 extensions.

## Auto-Trigger Conditions

Apply automatically when any of the following is true:
- GitHub org is `netresearch` or composer vendor is `netresearch/`
- Creating/modifying HTML pages, dashboards, reports, docs pages, or component demos
- Creating extension icons or branded UI assets
- Prompt contains branding terms (e.g. logo, style guide, brand colors)
- Another skill generates user-facing visual content

## Select the Output Profile First

- **Hosted TYPO3 manuals** (`Documentation/`, `guides.xml`, docs.typo3.org):
  follow `references/typo3-docs-branding.md` with the `typo3-docs` skill. Keep
  TYPO3's official theme, header, fonts and button colors. Add native navigation
  cards, decorative teal underlines and a Netresearch closing card in the manual
  content. Render every maintained language and inspect desktop/mobile output.
- **Standalone branded pages**, dashboards and reports: apply the hard validity
  rules below and the web design references. The header-logo and Raleway/Open
  Sans requirements belong to this profile, not the hosted-manual profile.
- **Extension icons, metadata and README files**: use their artifact-specific
  requirements; they are not standalone HTML pages.

## Hard Validity Rules for Standalone Branded Pages

Output is invalid if any item is missing:
1. Header logo (`assets/logos/netresearch-symbol-only.svg`, or fallback from `references/logo-svg.md`)
2. Brand colors: `#2F99A4` (primary), `#FF4D00` (accent only), `#585961` (text)
3. Typography intent: Raleway for headlines/UI emphasis, Open Sans for body/forms
4. Footer includes link to `https://www.netresearch.de/` and text `Netresearch DTT GmbH`

Apply the selected profile within the user's instructions.

## Mandatory Logo Rendering Behavior

Logo source priority:
1. `assets/logos/netresearch-symbol-only.svg`
2. `references/logo-svg.md` (inline SVG fallback)
3. `references/logo.md` (text fallback for SVG-limited agents)

Rules for standalone branded pages (hosted manuals use their own profile):
- Include logo exactly once in top header/nav for branded pages
- Minimum size `32x32px`; recommended `40–56px` in headers
- Preserve aspect ratio
- No recolor, distortion, filters, shadows, outlines, substitutions, or approximations
- If clickable, link to `https://www.netresearch.de/`

## Active Reference Workflow

Select the output profile before loading its references. For standalone pages:
1. `references/colors.md` for palette/token mapping
2. `references/typography.md` for font roles and scale
3. `references/web-design.md` for page construction, layout, components and spacing
4. `references/logo.md` and `references/logo-svg.md` for logo fallback behavior
5. `references/typo3-extension-branding.md` for TYPO3 context
6. `references/co-branding.md` for endorsement lines, only on an explicit co-branding request

For hosted TYPO3 manuals, start with `references/typo3-docs-branding.md` and
inspect the reference manual's current source and rendered output before editing.

## Core Brand System

- CSS variables are `--nr-*` — the vendor prefix is the point: these tokens land in a
  project's own stylesheet, where `--color-primary` may already mean something else.
  Checkpoint NB-16 greps for them. Canonical set, with values:

  | Token | Value | Role |
  |---|---|---|
  | `--nr-primary` | `#2F99A4` | surfaces, borders, icons, chart series, display type ≥24px — 3.38:1, not a text colour at body size |
  | `--nr-primary-fill` | `#257880` | a filled surface carrying white text (5.15:1) |
  | `--nr-primary-text` | `#15585E` | links, labels, small type on white (8.11:1) |
  | `--nr-primary-deep` | `#0A5057` | hover for the above (9.14:1) |
  | `--nr-accent` | `#FF4D00` | accent as a fill or marker — 3.33:1, never body text |
  | `--nr-accent-dark` | `#CC3D00` | accent fill carrying white text (4.96:1) |
  | `--nr-accent-text` | `#9A2E00` | accent emphasis in text (7.60:1) |
  | `--nr-text` | `#585961` | body copy (6.96:1) |
  | `--nr-text-secondary` | `#6E6F78` | help, meta, captions (4.99:1) |
  | `--nr-bg` / `--nr-bg-alt` | `#FFFFFF` / `#F5F5F5` | page and section background |
  | `--nr-border` | `#CCCDCC` | dividers and decoration only (1.59:1) |
  | `--nr-border-strong` | `#8A8B93` | the visible boundary of an interactive control — SC 1.4.11 wants 3:1 |
  | `--nr-border-light` | `#E5E5E5` | hairlines |

  Dark surfaces use a different set entirely — see `references/colors.md`.
- Accent orange is highlight-only and must not dominate surfaces
- Accessibility: WCAG AA minimum contrast and semantic structure
- Footer branding is mandatory in user-facing branded pages

## Building a Branded Page

The rules above fix *what* Netresearch looks like; this section fixes *how* a page is built
from them. It applies to every branded page, dashboard and app screen. Start from
`templates/styles.css`, which implements all of it; `references/web-design.md` ("How a branded
page is built") gives the reasoning and every component.

- **One bold surface per page**: the petrol gradient `#257880 → #15585E → #0A5057` with the
  nested-square motif carries the hero, a split brand panel or an app header band. Everything
  else stays white or `#F5F5F5`, apart from the mandatory anthracite footer.
- **Depth through hairlines**: 1px `--nr-border-light` border plus a layered soft shadow;
  radii 10px for controls, 16px for cards, 24px for hero panels and dialogs. No 4px boxes, no
  hover jumps, no `transition: all`.
- **Hierarchy through type**: headings in `--nr-ink` `#25272D`, left-aligned, with an
  uppercase eyebrow whose orange dot is the accent in its intended role.
- **State in form as well as colour**: status as a pill with dot and word (`.badge-*`),
  metrics as tiles with tabular figures (`.stat`), messages as white notice cards with an icon
  tile in the state's tint (`.notice-*`). No coloured edge stripes on cards, notices or panels.
- **Controls that read as controls**: 48px inputs and buttons, 3:1 borders, a solid focus
  outline (`--nr-focus`, white on the gradient), drawn checkboxes, segmented controls for two to
  four views.
- **Steps for real sequences, split layout for onboarding**: sign-in, request and upload
  screens put the brand panel with the process steps left and the task right.
- **Both schemes**: every colour token has a dark value (`references/colors.md`); honour
  `prefers-color-scheme` and `data-theme`.

## Co-branding (optional)

Applies only when a request explicitly asks to combine Netresearch with a second brand (platform, Netresearch product brand, customer). A brand named as the topic is no such request: a Netresearch page about OroCommerce stays Netresearch branding only.
- Netresearch stays the sender; the Hard Validity Rules apply unchanged.
- The second brand appears as a content accent; an endorsement line names the role of Netresearch.
- Output where another brand is the sender is out of scope.
- Roles, line catalog and guardrails: `references/co-branding.md`.

## TYPO3 Extension Requirements

- Icon path: `Resources/Public/Icons/Extension.svg` (teal `#2F99A4`)
- Composer vendor prefix: `netresearch/`
- `author_company`: `Netresearch DTT GmbH`
- Description suffix: `- by Netresearch`
- Contact: `typo3@netresearch.de`

## Brand Assets

- `assets/markdown-pdf.css` — branded stylesheet for `markdown-to-pdf-skill`; apply via `--css`. Its `.page-header`/`.page-footer` running elements aren't emitted by `convert.py`; the caller must supply HTML containing them (see that skill's `SKILL.md`).
- `assets/markdown-pdf-logo.svg` — standalone Netresearch logo (brand-teal/grey) for general use.
- `assets/markdown-pdf-logo-white.svg` — white-fill variant for the `.page-header` running header, where the teal/grey logo has no contrast on the teal background (`--nr-primary`). The sanctioned exception to "no recoloring" — do not use elsewhere.

## Licensing by artifact type

"The Netresearch licence" is not one licence. Pick by what the artifact is:

| Artifact | Licence |
|---|---|
| TYPO3 extension (`netresearch/t3x-*`, any `typo3-cms-extension`) | `AGPL-3.0-or-later`, or `GPL-2.0-or-later` where the extension must sit alongside GPL-2.0-only code — TYPO3 core is GPL-2.0-or-later and an extension inherits that obligation |
| Agent skill, library, CLI, internal tool | Split: code `MIT`, prose and reference content `CC-BY-SA-4.0`, shipped as `LICENSE-MIT` + `LICENSE-CC-BY-SA-4.0` with the SPDX expression `(MIT AND CC-BY-SA-4.0)` |
| Brand assets (logo files, colour specs, this skill's references) | `CC-BY-SA-4.0`, and the logo additionally carries the trademark rules in `references/logo.md` — a licence does not permit recolouring or distortion |

Details for each: `references/typo3-extension-branding.md` for extensions,
`references/README-branding.md` for skills and tools.

## No editorializing

In branded reports, PR/commit text and docs, state what a change or output does, not how good the work is — no narrating expected results ("all tests green") or self-praise ("clean"). Judged by tone, not a wordlist. See `references/no-editorializing.md`.

## References

- `references/colors.md`
- `references/typography.md`
- `references/web-design.md`
- `references/logo.md`
- `references/logo-svg.md`
- `references/typo3-extension-branding.md`
- `references/typo3-docs-branding.md`
- `references/README-branding.md`
- `references/no-editorializing.md`
- `references/co-branding.md` (only on an explicit co-branding request)
