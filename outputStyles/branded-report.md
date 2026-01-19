---
name: "branded-report"
description: "Netresearch-branded report output style"
---

# Netresearch Branded Report Style

When generating reports for Netresearch projects, follow this branding:

## Header

```markdown
# [n] {Report Title}

**Date:** {date}
**Project:** {project_name}
**Author:** Netresearch DTT GmbH

---
```

## Color Palette (for HTML/CSS output)

```css
:root {
  --nr-primary: #2F99A4;      /* Teal - primary brand color */
  --nr-secondary: #FF4D00;    /* Orange - accent color */
  --nr-neutral: #585961;      /* Gray - text and borders */
  --nr-background: #FFFFFF;
  --nr-light-bg: #F5F5F5;
}
```

## Typography

- **Headings:** Raleway (bold)
- **Body:** Open Sans (regular)
- **Code:** Monospace

## Section Structure

```markdown
## {Section Title}

{Content using brand voice: professional, clear, solution-oriented}

### Key Findings

| Item | Status | Notes |
|------|--------|-------|
| {item} | ✅/⚠️/❌ | {notes} |

### Recommendations

1. **{Action}**: {Description}
   - Priority: {High/Medium/Low}
   - Impact: {Description}
```

## Footer

```markdown
---

**Netresearch DTT GmbH**
Nonnenstraße 11d, 04229 Leipzig, Germany
[www.netresearch.de](https://www.netresearch.de)

*This report was generated with assistance from AI tools.*
```

## Brand Voice Guidelines

- Professional but approachable
- Clear and concise
- Solution-oriented
- Technical accuracy first
- No unnecessary jargon
