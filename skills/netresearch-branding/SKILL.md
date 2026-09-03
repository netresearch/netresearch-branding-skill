---
name: netresearch-branding
description: "Use when working with ANY Netresearch visual output: branded pages, dashboards, HTML reports, extension icons, README badges, or CSS theming. Enforce strict brand compliance with mandatory logo usage, brand colors, typography, footer, and reference-driven implementation."
license: "(MIT AND CC-BY-SA-4.0)"
metadata:
  version: "2.12.0"
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

## Hard Validity Rules

Output is invalid if any item is missing:
1. Header logo (`assets/logos/netresearch-symbol-only.svg`, or fallback from `references/logo-svg.md`)
2. Brand colors: `#2F99A4` (primary), `#FF4D00` (accent only), `#585961` (text)
3. Typography intent: Raleway for headlines/UI emphasis, Open Sans for body/forms
4. Footer includes link to `https://www.netresearch.de/` and text `Netresearch DTT GmbH`

If user instructions conflict, keep these rules and explain constraints.

## Mandatory Logo Rendering Behavior

Logo source priority:
1. `assets/logos/netresearch-symbol-only.svg`
2. `references/logo-svg.md` (inline SVG fallback)
3. `references/logo.md` (text fallback for SVG-limited agents)

Rules:
- Include logo exactly once in top header/nav for branded pages
- Minimum size `32x32px`; recommended `40–56px` in headers
- Preserve aspect ratio
- No recolor, distortion, filters, shadows, outlines, substitutions, or approximations
- If clickable, link to `https://www.netresearch.de/`

## Active Reference Workflow

Operationalize references in every branded output:
1. `references/colors.md` for palette/token mapping
2. `references/typography.md` for font roles and scale
3. `references/web-design.md` for layout/components/spacing
4. `references/logo.md` and `references/logo-svg.md` for logo fallback behavior
5. `references/typo3-extension-branding.md` for TYPO3 context

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
- `references/README-branding.md`
- `references/no-editorializing.md`
