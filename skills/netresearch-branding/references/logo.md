# Netresearch Logo Specification (Agent-Readable)

This document describes the Netresearch symbol-only logo in pure text for agents that cannot parse SVG files.

## Purpose

Use this reference whenever logo placement or reconstruction is needed but `assets/logos/netresearch-symbol-only.svg` cannot be opened.

## Canonical Asset

- Primary logo file: `assets/logos/netresearch-symbol-only.svg`
- Logo type: symbol-only `[n]` mark (without wordmark)
- Title metadata: `Netresearch DTT GmbH`

## Visual Construction

The symbol is composed of **two combined shapes**:

1. **Outer bracket/frame shape (turquoise)**
   - Creates a geometric frame with open inner area
   - Has a left and right vertical structure with top/bottom caps
   - Looks like a stylized enclosing form around the inner character

2. **Inner lowercase "n" shape (dark gray)**
   - Compact, rounded-corner geometric letterform
   - Starts with a vertical stem and transitions into an arch/shoulder
   - Proportioned to sit centered inside the outer frame

Together, both paths form the recognizable Netresearch symbol.

## Colors

Use exact brand colors:

- Outer frame: `#2F99A4` (Primary Turquoise)
- Inner "n": `#585961` (Brand Text Gray)

These are the **only** valid brand color values for the symbol. Any rendered output that uses different hex codes — even close approximations — is a brand-debt violation; correct it before shipping.

## Geometry and Proportions

- Native canvas intent: square-like icon area
- SVG viewBox: `-75 -75 440 440`
- Effective symbol dimensions are centered and balanced for icon usage
- Keep aspect ratio fixed (no stretching)
- Maintain clear space around symbol (minimum 0.25× of logo width on each side)

## Minimum Sizes

- Absolute minimum icon size: `32×32px`
- Recommended digital size: `>=120px` width when logo is a visual anchor
- For favicon-like use, simplify context, not the logo geometry

## Background Rules

- Preferred: white or very light neutral background
- Dark background allowed only with sufficient contrast
- Never place on noisy imagery without a solid backing area

## Do / Don’t

### Do
- Use symbol-only logo in headers, cards, extension icons, and branded UI elements
- Keep turquoise shape dominant and gray inner letter clearly visible
- Link clickable logo instances to `https://www.netresearch.de/`

### Don’t
- Don’t recolor with non-brand colors
- Don’t add gradients, strokes, glows, drop-shadows, or effects to the logo itself
- Don’t rotate, skew, or distort
- Don’t crop the mark
- Don’t replace with generic placeholder icons

## Placement Requirements

For branded HTML output, all of the following are mandatory:

1. Header includes the symbol-only logo
2. Footer includes text `Netresearch DTT GmbH` and link to `https://www.netresearch.de/`
3. Typography and colors follow the skill references

## Fallback Strategy for Non-SVG Agents

If SVG cannot be rendered:

1. Use this document to describe and validate the logo appearance
2. Prefer embedding the inline SVG from `references/logo-svg.md`
3. If inline SVG is impossible, use a high-fidelity PNG export derived from the canonical SVG
4. Never omit logo usage in branded outputs
