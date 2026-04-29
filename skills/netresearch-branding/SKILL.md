---
name: netresearch-branding
description: "Use when working with ANY Netresearch visual output: branded pages, dashboards, HTML reports, extension icons, README badges, or CSS theming. Apply logo, brand colors (#2F99A4, #FF4D00, #585961), Raleway+Open Sans typography. Triggers on: Netresearch branding, brand colors, logo, extension icon, branded page, style guide."
license: "(MIT AND CC-BY-SA-4.0)"
metadata:
  version: "2.6.2"
  repository: "https://github.com/netresearch/netresearch-branding-skill"
  author: "Netresearch DTT GmbH"
---

# Netresearch Brand Guidelines

Apply Netresearch brand identity to web projects, documentation, and TYPO3 extensions.

## Auto-Trigger Conditions

Apply when:
- GitHub org is `netresearch` or composer.json has `netresearch/` vendor
- Creating HTML pages, dashboards, reports, or landing pages
- Another skill generates visual content

## MANDATORY Requirements

1. **Logo**: `assets/logos/netresearch-symbol-only.svg` in header (min 32x32px)
2. **Colors**: `#2F99A4` (primary), `#FF4D00` (accent only), `#585961` (text)
3. **Typography**: Raleway (headlines, buttons, nav), Open Sans (body, forms)
4. **Footer**: Link to https://www.netresearch.de/ + "Netresearch DTT GmbH"

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
- `assets/markdown-pdf-logo.svg` — white logo embedded by `markdown-pdf.css`.

## References

- `references/colors.md` - Full palette, WCAG contrast ratios, approved combinations
- `references/typography.md` - Font weights, sizes, responsive scale
- `references/web-design.md` - Component library, layout patterns, pre-launch checklist
- `references/typo3-extension-branding.md` - Extension metadata, badge standards

---

> **Contributing:** https://github.com/netresearch/netresearch-branding-skill
