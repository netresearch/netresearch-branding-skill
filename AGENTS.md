# Agent Guide — netresearch-branding-skill

## Repo Structure

```
.
├── skills/netresearch-branding/
│   ├── SKILL.md                    # Main skill definition (brand guidelines)
│   ├── checkpoints.yaml            # Skill evaluation checkpoints
│   ├── references/                 # Brand reference docs
│   │   ├── colors.md               # Color palette (Hex, RGB, CMYK, Pantone)
│   │   ├── typography.md           # Font specs and scale
│   │   ├── web-design.md           # Component styles and layouts
│   │   └── typo3-extension-branding.md
│   └── templates/                  # Ready-to-use HTML/CSS
│       ├── landing-page.html
│       └── styles.css
├── assets/logos/                    # Logo files (SVG)
├── examples/components.html        # Interactive component showcase
├── outputStyles/                   # Output style templates
├── evals/evals.json                # Skill evaluation suite
├── Build/Scripts/                  # Build scripts
├── Build/hooks/                    # Git hooks
├── .claude-plugin/plugin.json      # Claude Code plugin manifest
├── composer.json                   # Composer package definition
├── docs/                           # Architecture and planning docs
│   └── ARCHITECTURE.md
└── .github/workflows/              # CI workflows
```

## Commands

No Makefile or npm scripts. Available commands:

- `composer install` — install dependencies (requires [composer-agent-skill-plugin](https://github.com/netresearch/composer-agent-skill-plugin))

## Rules

1. **Colors**: Primary `#2F99A4` (turquoise), accent `#FF4D00` (orange — accent only), text `#585961`
2. **Typography**: Raleway for headlines, Open Sans for body, Calibri for documents
3. **Logo**: Use `assets/logos/netresearch-symbol-only.svg`, min 32x32px icon / 120px digital
4. **Footer**: Must link to https://www.netresearch.de/ with "Netresearch DTT GmbH"
5. **Accessibility**: WCAG AA compliance mandatory
6. **White space**: High white space design principle throughout
7. **TYPO3 extensions**: Icon at `Resources/Public/Icons/Extension.svg`, vendor `netresearch/`

## References

- [SKILL.md](skills/netresearch-branding/SKILL.md) — full brand guidelines and auto-trigger rules
- [colors.md](skills/netresearch-branding/references/colors.md) — complete color specs with CSS variables
- [typography.md](skills/netresearch-branding/references/typography.md) — font weights, sizes, responsive scale
- [web-design.md](skills/netresearch-branding/references/web-design.md) — component library and layout patterns
- [typo3-extension-branding.md](skills/netresearch-branding/references/typo3-extension-branding.md) — TYPO3 extension branding requirements
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture overview
