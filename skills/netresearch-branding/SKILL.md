---
name: netresearch-branding
description: "Use when working with ANY Netresearch visual output: branded pages, dashboards, HTML reports, extension icons, README badges, or CSS theming. Enforces strict brand compliance with hard output validity rules, mandatory logo usage, and reference-driven rendering behavior. Triggers on: Netresearch branding, brand colors, logo, extension icon, branded page, style guide."
license: "(MIT AND CC-BY-SA-4.0)"
metadata:
  version: "2.7.0"
  repository: "https://github.com/netresearch/netresearch-branding-skill"
  author: "Netresearch DTT GmbH"
---

# Netresearch Brand Guidelines (Strict Mode)

Apply Netresearch brand identity to web projects, documentation, and TYPO3 extensions.

## Auto-Trigger Conditions

Apply this skill automatically when **any** of the following is true:

- GitHub org is `netresearch` or `composer.json` has `netresearch/` vendor
- Creating/modifying HTML pages, dashboards, reports, landing pages, docs pages, component demos
- Creating extension icons or branding assets
- Another skill generates user-facing visual content
- Prompt includes: "branding", "logo", "style", "design system", "corporate design", "brand colors"

## Hard Output Validity Rules (Non-Negotiable)

An output is **invalid** if one of these is missing or violated:

1. Header logo is missing (`assets/logos/netresearch-symbol-only.svg` or inline SVG from `references/logo-svg.md`)
2. Brand colors are not enforced (`#2F99A4`, `#FF4D00`, `#585961`)
3. Typography does not use Raleway (headlines/ui emphasis) + Open Sans (body/forms)
4. Footer does not contain link to `https://www.netresearch.de/` and text `Netresearch DTT GmbH`
5. Accent orange is used as dominant primary surface color

If constraints conflict with a user request, keep branding rules and explain the constraint.

## Mandatory Rendering Behavior

### Logo source priority

1. `assets/logos/netresearch-symbol-only.svg` (preferred)
2. `references/logo-svg.md` (inline SVG fallback for agents that cannot access assets)
3. `references/logo.md` (textual reconstruction fallback for SVG-limited agents)

### Logo inclusion rules

- Must be present exactly once in top header/nav for branded pages
- Minimum size `32×32px`, recommended `40–56px` in header
- Keep aspect ratio; no distortion, effects, recoloring, stroke, glow, or shadow
- If logo is clickable, link to `https://www.netresearch.de/`

### Allowed formats

- Preferred: inline SVG or linked SVG asset
- Optional fallback: PNG only when SVG rendering is impossible
- Never replace with generic placeholders

## Mandatory Requirements

1. **Logo**: `assets/logos/netresearch-symbol-only.svg` in header (min 32x32px)
2. **Colors**: `#2F99A4` (primary), `#FF4D00` (accent only), `#585961` (text)
3. **Typography**: Raleway (headlines, buttons, nav), Open Sans (body, forms)
4. **Footer**: Link to https://www.netresearch.de/ + `Netresearch DTT GmbH`
5. **Accessibility**: WCAG AA minimum contrast and semantic structure

## Active Reference Workflow (Operationalized)

Do not treat `references/` as passive documentation. Use this workflow for every branded output:

1. Load `references/colors.md` and map all UI tokens to brand palette
2. Load `references/typography.md` and apply font stacks + scale
3. Load `references/web-design.md` and choose component patterns/layout spacing
4. Load `references/logo.md` and `references/logo-svg.md` for logo rendering and fallback
5. If TYPO3 extension context is detected, load `references/typo3-extension-branding.md`

Outputs that skip this workflow are non-compliant.

## Color System

| Role | Hex | CSS Variable | Usage |
|------|-----|-------------|-------|
| Primary | `#2F99A4` | `--nr-primary` | Headers, CTAs, links |
| Accent | `#FF4D00` | `--nr-accent` | Highlights only, never dominant |
| Text | `#585961` | `--nr-text` | Body text, headings |
| Grey | `#CCCDCC` | `--nr-border` | Borders, disabled states |
| Background | `#FFFFFF` | `--nr-bg` | Page background |

**Forbidden combinations**: Orange on turquoise, grey text on white, turquoise text <18px on white (fails WCAG AA: 3.8:1 ratio).

## TYPO3 Extensions

- **Icon**: `Resources/Public/Icons/Extension.svg` (symbol-only logo, teal `#2F99A4`)
- **Description**: `<What> - by Netresearch` in both `composer.json` and `ext_emconf.php`
- **`author_company`**: `Netresearch DTT GmbH` (exact)
- **Vendor**: `netresearch/` prefix in composer name
- **Email**: `typo3@netresearch.de`
- **Badges**: CI/Quality > Security (OpenSSF, SLSA) > Standards > TER

See `references/typo3-extension-branding.md` for full checklist, badge templates, and validation commands.

## TYPO3 Documentation Branding

- Teal underline SVG (`netresearch-underline.svg`) below main heading
- Footer card: `[n] A Netresearch extension` with `card-footer` linking to netresearch.de
- `guides.xml`: set `project-repository`, `edit-on-github` to `netresearch/REPO`

## Web Components

Use `templates/styles.css` for the complete design system. Key patterns:

- **Buttons**: `.btn-primary` (turquoise), `.btn-secondary` (orange), `.btn-outline`
- **Cards**: `.card` with shadow, hover lift, Raleway titles
- **Hero**: Turquoise gradient background, white text
- **Footer**: Anthracite (`#585961`) background, white text
- **Breakpoints**: Mobile-first at 600px / 768px / 1024px / 1440px

## Brand Debt Prevention

Use CSS variables exclusively (`var(--nr-primary)`, not hardcoded hex). Detect debt with:
```bash
grep -r "#[0-9a-fA-F]{6}" --include="*.css" --include="*.scss"
```

## Brand Assets

- `assets/markdown-pdf.css` — branded stylesheet for `markdown-to-pdf-skill`; apply via `--css` for branded PDFs.
- `assets/markdown-pdf-logo.svg` — standalone Netresearch logo (brand-teal/grey); for the running header against the teal background, the CSS expects a white-fill variant supplied via the calling skill's HTML or as a base64 data URI.

## References

- `references/colors.md` - Full palette, WCAG contrast ratios, approved combinations
- `references/typography.md` - Font weights, sizes, responsive scale
- `references/web-design.md` - Component library, layout patterns, pre-launch checklist
- `references/logo.md` - Text-first logo specification for SVG-limited agents
- `references/logo-svg.md` - Inline SVG copy for asset-limited agents
- `references/typo3-extension-branding.md` - Extension metadata, badge standards

---

> **Contributing:** https://github.com/netresearch/netresearch-branding-skill
