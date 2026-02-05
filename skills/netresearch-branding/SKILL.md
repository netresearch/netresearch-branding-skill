---
name: netresearch-branding
description: "Agent Skill: Apply Netresearch brand identity. MANDATORY for Netresearch projects. Include: (1) [n] logo, (2) colors #2F99A4/#FF4D00/#585961, (3) Raleway+Open Sans fonts."
---

# Netresearch Brand Guidelines

Apply Netresearch brand identity to web projects, documentation, and digital content.

## Auto-Trigger Conditions

Apply when:
- GitHub org is `netresearch` or composer.json has `netresearch/` vendor
- Creating HTML pages, dashboards, landing pages
- Another skill generates visual content

## MANDATORY Requirements

1. **Logo**: `assets/logos/netresearch-symbol-only.svg` in header (min 32×32px)
2. **Colors**: `#2F99A4` (primary), `#FF4D00` (accent only), `#585961` (text)
3. **Typography**: Raleway (headlines), Open Sans (body)
4. **Footer**: Link to https://www.netresearch.de/ + "Netresearch DTT GmbH"

## Quick Reference

**Colors**: `#2F99A4` turquoise · `#FF4D00` orange · `#585961` text · `#CCCDCC` grey

**Fonts**: Raleway (h1-h6) · Open Sans (body) · Calibri (docs fallback)

**Logo**: Min 120px digital · Min 32×32 icon

## References

- `references/colors.md` - Complete color specifications, CSS variables
- `references/typography.md` - Font weights, sizes, scale
- `references/web-design.md` - Component styles, layouts
- `references/typo3-extension-branding.md` - Extension requirements

## TYPO3 Extensions

- Extension icon: `Resources/Public/Icons/Extension.svg` (symbol-only logo)
- Description: `<What> - by Netresearch`
- `author_company`: `Netresearch DTT GmbH`
- Vendor: `netresearch/` prefix

## Pre-Launch QA Tools

Before launching branded content, verify compliance with automated audit tools:

| Tool | Purpose | Check |
|------|---------|-------|
| **axe DevTools** | WCAG accessibility | Color contrast, ARIA labels, keyboard navigation |
| **WAVE** | Accessibility evaluation | Missing alt text, heading structure, form labels |
| **Chrome Lighthouse** | Performance + accessibility | Contrast ratios, SEO, performance scores |
| **WebAIM Contrast Checker** | Color verification | Ensure #2F99A4/#FF4D00 on backgrounds meet AA |

**Minimum requirements:**
- Lighthouse Accessibility score: 90+
- Zero critical axe violations
- All WAVE errors resolved

See `references/web-design.md` for the complete pre-launch checklist.

## Brand Debt

Brand inconsistencies accumulate over time ("brand debt"). Identify and remediate:

**Detection signals:**
- Hardcoded hex values instead of CSS variables (`#2f99a4` vs `var(--nr-primary)`)
- Inline styles overriding brand colors
- Non-standard fonts (Arial, Helvetica instead of Raleway/Open Sans)
- Logo variations (wrong aspect ratio, missing SVG, rasterized versions)
- Inconsistent button styles across pages

**Remediation workflow:**
1. **Audit**: Run `grep -r "#[0-9a-fA-F]{6}" --include="*.css" --include="*.scss"` to find hardcoded colors
2. **Centralize**: Move all brand values to CSS custom properties
3. **Document**: Track deviations in a `BRAND_DEBT.md` file with fix priority
4. **Monitor**: Schedule quarterly brand audits using the QA tools above

**Prevention:**
- Use CSS variables exclusively: `var(--nr-primary)`, `var(--nr-accent)`, `var(--nr-text)`
- Lint for hardcoded brand colors in CI/CD
- Include brand review in PR checklists for UI changes

---

> **Contributing:** https://github.com/netresearch/netresearch-branding-skill
