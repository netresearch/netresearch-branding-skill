---
name: netresearch-branding
description: "Use when working with ANY Netresearch visual output: branded pages, dashboards, HTML reports, extension icons, README badges, or CSS theming. Enforce strict brand compliance with mandatory logo usage, brand colors, typography, footer, and reference-driven implementation."
license: "(MIT AND CC-BY-SA-4.0)"
metadata:
  version: "2.6.2"
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
- No recolor, distortion, filters, shadows, outlines, or substitutions
- If clickable, link to `https://www.netresearch.de/`

## Active Reference Workflow

Operationalize references in every branded output:
1. `references/colors.md` for palette/token mapping
2. `references/typography.md` for font roles and scale
3. `references/web-design.md` for layout/components/spacing
4. `references/logo.md` and `references/logo-svg.md` for logo fallback behavior
5. `references/typo3-extension-branding.md` for TYPO3 context

## Core Brand System

- CSS variables preferred: `--nr-primary`, `--nr-accent`, `--nr-text`, `--nr-border`, `--nr-bg`
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

- `assets/markdown-pdf.css` — branded stylesheet for `markdown-to-pdf-skill`; apply via `--css` for branded PDFs.
- `assets/markdown-pdf-logo.svg` — standalone Netresearch logo (brand-teal/grey); for the running header against the teal background, the CSS expects a white-fill variant supplied via the calling skill's HTML or as a base64 data URI.

## References

- `references/colors.md`
- `references/typography.md`
- `references/web-design.md`
- `references/logo.md`
- `references/logo-svg.md`
- `references/typo3-extension-branding.md`
