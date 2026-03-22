# Architecture — netresearch-branding-skill

## Purpose

Provides Netresearch brand guidelines as an agent skill, enabling AI coding assistants to generate brand-compliant web content, templates, and components.

## Skill Structure

The repo follows the [Agent Skills specification](https://agentskills.io/specification):

```
skills/netresearch-branding/
├── SKILL.md           # Entry point — frontmatter metadata + core rules
├── checkpoints.yaml   # Evaluation criteria for skill quality
├── references/        # Detailed reference documents (loaded on demand)
└── templates/         # HTML/CSS templates for direct use
```

## Key Components

### SKILL.md (Entry Point)
Contains YAML frontmatter (name, description, version, triggers) and the mandatory brand rules (colors, typography, logo, footer). This is what agents read first.

### References (Lazy-Loaded)
Detailed specifications that agents consult as needed:
- **colors.md** — full palette with Hex, RGB, CMYK, Pantone, NCS, CSS custom properties, WCAG contrast ratios
- **typography.md** — font families, weights, responsive scale, loading strategies
- **web-design.md** — component library (buttons, cards, forms, navigation), grid system, breakpoints
- **typo3-extension-branding.md** — TYPO3-specific branding (icons, composer metadata, ext_emconf)

### Templates
Production-ready starter files:
- **landing-page.html** — complete branded landing page
- **styles.css** — full CSS framework with custom properties

### Output Styles
Templates in `outputStyles/` for formatting branded reports and documentation.

### Evaluations
`evals/evals.json` defines test scenarios for verifying skill behavior.

## Plugin Integration

The `.claude-plugin/plugin.json` manifest registers the skill with Claude Code. The `composer.json` enables installation via Composer for PHP projects using `netresearch/composer-agent-skill-plugin`.

## Data Flow

1. Agent detects brand-related task (auto-trigger or manual `/skill netresearch-branding`)
2. Agent reads `SKILL.md` for mandatory rules and quick reference
3. Agent consults specific `references/*.md` files as needed
4. Agent uses `templates/` as starting points for new pages
5. Agent validates output against brand rules before delivery
