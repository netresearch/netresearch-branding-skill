<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
<!-- SPDX-FileCopyrightText: Netresearch DTT GmbH -->

# Hosted TYPO3 Manual Branding

Use this profile for extension manuals rendered from `Documentation/` with
`guides.xml` for docs.typo3.org. Work with the `typo3-docs` skill for renderer
configuration, RST syntax and documentation validation.

## Keep the Platform Theme

The official TYPO3 theme owns the site header, navigation, typography, button
colors and platform footer. Preserve them. Do not inject the standalone-page
header logo, Raleway/Open Sans imports or global brand CSS into a hosted manual.
Its content-level Netresearch closing card provides the company identification.

The reference manual is [nr-llm on docs.typo3.org](https://docs.typo3.org/p/netresearch/nr-llm/main/en-us/),
with [source in `Documentation/Index.rst`](https://github.com/netresearch/t3x-nr-llm/blob/main/Documentation/Index.rst).
Inspect both the current source and the actual rendered HTML before copying a
pattern; record the source revision and inspection date. The source may be
newer than the published manual. Copy the layout pattern, not its product claims
or unrelated configuration.

On 2026-10-18, the published nr-llm manual used standard TYPO3 theme fonts
(Source Sans 3 and Source Code Pro), native cards and teal image accents. It did
not require a custom teal stylesheet or a replacement for TYPO3's header. Treat
font names as observations of that theme, not fonts to pin in an extension.

## Content Elements

### Decorative teal underline

Place an underline directly below the landing-page heading, and a smaller one
inside the closing card:

```rst
.. image:: /Images/netresearch-underline.svg
   :alt:
   :width: 200px
   :class: no-border
```

The [reference SVG](https://github.com/netresearch/t3x-nr-llm/blob/main/Documentation/Images/netresearch-underline.svg)
is a 200 by 4 pixel rounded rectangle:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="4" viewBox="0 0 200 4">
  <rect width="200" height="4" rx="2" fill="#2F99A4"/>
</svg>
```

Keep its alt text empty because it is decorative. This rectangle is an accent,
not the authentic Netresearch logo. Do not present it or the literal `[n]` card
title as a replacement for the official logo in extension icons or standalone
page headers. Teal is appropriate here as decoration; it is not a body-text or
button-label color.

### Native navigation cards

Use the official [`card-grid`, `card` and `card-footer` directives](https://docs.typo3.org/m/typo3/docs-how-to-document/main/en-us/Reference/ReStructuredText/Content/Cards.html).
Keep a single column on small screens and use additional columns from medium
screens. A two-column starting point is:

```rst
.. card-grid::
   :columns: 1
   :columns-md: 2
   :gap: 4
   :card-height: 100

   .. card:: 📦 Installation

      Install and activate the extension.

      .. card-footer:: :ref:`Installation instructions <installation>`
         :button-style: btn btn-primary stretched-link

   .. card:: 🔒 Security

      Understand the protection and its limits.

      .. card-footer:: :ref:`Security model <security>`
         :button-style: btn btn-secondary stretched-link
```

Use existing target labels from the extension; the sample assumes
`installation` and `security` exist. Give each card a short task-specific
description and a meaningful link label. Use at most one stretched link per
card. Keep the link on the `card-footer` directive line and its options directly
below it, without a blank line. Use plain UTF-8 emoji in directive titles, not
RST substitutions.

Preserve the manual's introduction, installation instructions, security scope,
anchors and complete table of contents. For a plug-and-play security extension,
the default protection and its boundaries must remain visible above or beside
the navigation cards. Cards organize navigation; they do not replace that
explanation. Do not add unrelated sections to match a reference's card count.

### Netresearch closing card

Place this card near the end of the landing page, within the manual content:

```rst
.. card:: [n] A Netresearch extension

   .. image:: /Images/netresearch-underline.svg
      :alt:
      :width: 120px
      :class: no-border

   Developed and maintained by Netresearch DTT GmbH.

   .. card-footer:: `netresearch.de <https://www.netresearch.de/>`__
      :button-style: btn btn-secondary stretched-link
```

Translate the card heading and prose for maintained translations; keep the
company's exact name and website link. Add service or history claims only when
verified for the project. Leave TYPO3's platform footer in place.

## Language Roots and Assets

Each maintained language needs its own rendered check. For example,
`Documentation/Localization.de_DE/` can be its own renderer configuration root:
an absolute RST path such as `/Images/netresearch-underline.svg` then resolves
inside that root. Verify the resolved paths instead of assuming that the English
asset is shared automatically.

Where separate roots require it, put a regular copy of the accent SVG in both
`Documentation/Images/` and
`Documentation/Localization.de_DE/Images/`. Keep those copies identical. Avoid
symlinks and paths outside the renderer's mounted project. Keep navigation, labels and relevant security text consistent across the
project's maintained languages.

## Verify Rendered Output

1. Run the extraction and source validation prescribed by `typo3-docs`.
2. Render the full manual for every maintained language with the official
   renderer and `--fail-on-log`. Use the project's recorded image digest when
   one exists; do not update it merely to copy a layout. Do not treat
   `--minimal-test` or the presence of an SVG/RST directive as a full render.
3. Serve the generated files over HTTP and inspect them in an actual browser at
   desktop and mobile widths, for example 1440px and 390px. Use an isolated
   browser profile, not a personal authenticated profile.
4. Check screenshots and the rendered DOM: cards form the intended responsive
   grid; both underlines load with their intended widths; the closing card has
   the exact company name and working website link; navigation references and
   images resolve in each language; relevant text remains visible; there is no
   horizontal overflow or missing stylesheet, font or script. Inspect browser
   console and network errors, and check readable contrast and focus states.
5. Record renderer version/digest, language roots, viewport sizes and results.
   Distinguish source checks, renderer success, browser verification and the live
   hosted deployment. A successful local render does not prove publication.

For renderer invocation and output paths, follow the project's documented
command and the [official rendering-container reference](https://docs.typo3.org/m/typo3/docs-how-to-document/main/en-us/Reference/RenderingContainer.html).
If rendering or browser access is unavailable, report that specific check as
unverified; do not claim visual parity from source-file checks alone.
