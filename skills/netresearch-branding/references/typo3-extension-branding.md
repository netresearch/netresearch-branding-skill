<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
<!-- SPDX-FileCopyrightText: Netresearch DTT GmbH -->

# TYPO3 Extension Branding

**Purpose:** Ensure consistent Netresearch branding across all TYPO3 extensions developed by or for Netresearch.

## Extension Icon

**File Location:** `Resources/Public/Icons/Extension.svg`

The extension icon takes one of two forms. Both identify the package as a Netresearch extension; neither is a backend module icon (see "Module Icon").

### Feature tile (TYPO3 v14 style)

TYPO3 v14 draws its own extension icons as a filled square tile with a white glyph (for example `EXT:redirects/Resources/Public/Icons/Extension.svg`). A Netresearch extension for v14 may follow that style, as the reference extensions [netresearch/t3x-nr-textdb](https://github.com/netresearch/t3x-nr-textdb) and [netresearch/t3x-universal-messenger](https://github.com/netresearch/t3x-universal-messenger) do:

- a rounded square tile filled in turquoise `#2F99A4`, covering the whole 64×64 viewBox;
- the extension's feature glyph in white `#FFFFFF`, the same glyph its module icon uses;
- an orange `#FF4D00` dot in the top-right corner as the Netresearch marker;
- a `<title>` naming the extension and `Netresearch DTT GmbH`;
- fixed colours as presentation attributes, no `currentColor`: the Extension Manager shows the file as an `<img>`, where `currentColor` has no backend colour to inherit.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <title>TextDB - Netresearch DTT GmbH</title>
    <path fill="#2F99A4" d="M8 0h48a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V8a8 8 0 0 1 8-8Z"/>
    <path fill="#FFFFFF" d="..."/>                         <!-- feature glyph -->
    <circle cx="51" cy="13" r="5" fill="#FF4D00"/>          <!-- Netresearch marker -->
</svg>
```

### Symbol-only logo

The Netresearch symbol-only `[n]` logo, unchanged. It suits an extension without a single feature to depict and every extension that has not moved to the tile.

**SVG Source:**
```xml
<svg id="netresearch-logo" data-name="Netresearch Logo" xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 300 300">
    <defs>
        <style>
            .nr-frame{fill:#2F99A4;}
            .nr-letter{fill:#585961;}
        </style>
    </defs>
    <title>Netresearch DTT GmbH</title>
    <g>
        <path class="nr-frame"
              d="M209.6,0V31.62h32.77a26.38,26.38,0,0,1,26.44,26.43V242a26.38,26.38,0,0,1-26.44,26.44H209.6V300h47.93a42.77,42.77,0,0,0,42.86-42.86V42.89A42.76,42.76,0,0,0,257.53,0ZM43.25,0A42.76,42.76,0,0,0,.39,42.89V257.18A42.76,42.76,0,0,0,43.25,300H91.18V268.46H58.4A26.38,26.38,0,0,1,32,242v-184A26.37,26.37,0,0,1,58.4,31.62H91.18V0Z"
              transform="translate(-0.39 -0.04)"/>
        <path class="nr-letter"
              d="M221.44,120.41c0-34.48-13.94-57.82-48.93-57.82-26.62,0-48.54,7.74-64.17,26.56l-.7-22.06-28.31.06V232.94h31.59V124.69c7.14-18.38,32.14-34.8,53-34.5,27.38.4,25.2,26.24,26,45.81v96.94h31.58"
              transform="translate(-0.39 -0.04)"/>
    </g>
</svg>
```

**Color Values:**
- Frame (brackets): Turquoise `#2F99A4`
- Letter "n": Anthracite Grey `#585961`

## Module Icon

The backend **module** icon should differ from the **extension** icon: the extension icon (`Extension.svg`, a feature tile or the `[n]` logo) identifies the package in the Extension Manager, while the module icon identifies the *feature* (e.g. a passkey, a dashboard) in the backend's own colours. Do not reuse the `[n]` logo or the filled tile for a feature module.

**Standard:**
- Draw the feature glyph in `currentColor` and its accent in brand turquoise, written as **`var(--nr-icon-accent, #2F99A4)`** (see "Accent colour" below), so the icon adapts to the v14 light/dark backend.
- Use SVG **presentation attributes** (`fill="var(--nr-icon-accent, #2F99A4)"`, `fill="currentColor"`, `fill-rule="evenodd"`), **never the `style="..."` attribute** — the `style` attribute breaks under a hardened TYPO3 backend CSP (`style-src-attr`).
- Wrap the paths in a `<symbol>` and register the icon with `SvgSpriteIconProvider` in `Configuration/Icons.php` (see "Icon registration" below). When the colored v12/v13 variant (e.g. teal tile) and the flat v14 variant differ, version-split the source via `Typo3Version`.

**Example** (v14 flat variant — `currentColor` glyph + turquoise accent):
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <symbol id="module-glossary" viewBox="0 0 64 64">
    <path fill="currentColor" d="..."/>                                   <!-- adapts to light/dark -->
    <path fill="var(--nr-icon-accent, #2F99A4)" fill-rule="evenodd" d="..."/>  <!-- feature accent -->
  </symbol>
  <use href="#module-glossary"/>
</svg>
```

## Module Placement and Icon Registration

Reference implementations: [netresearch/t3x-nr-textdb#226](https://github.com/netresearch/t3x-nr-textdb/pull/226) and [netresearch/t3x-universal-messenger#203](https://github.com/netresearch/t3x-universal-messenger/pull/203) (placement), [netresearch/t3x-nr-textdb#230](https://github.com/netresearch/t3x-nr-textdb/pull/230) and [netresearch/t3x-universal-messenger#205](https://github.com/netresearch/t3x-universal-messenger/pull/205) (sprite module icon). Source references below are TYPO3 v14.3.10.

### Placement: a core group, no Netresearch group

A Netresearch extension does not register a top-level backend module group of its own (formerly `netresearch_module` with `labels`, `iconIdentifier` and `position`, but no `parent`). Each module is a submodule of the core group whose task it serves, like the modules of any other extension; a module's own third-level modules keep that module as their `parent`:

```php
// Configuration/Backend/Modules.php
return [
    'netresearch_textdb' => [
        'parent'         => 'content',
        'access'         => 'user',
        'iconIdentifier' => 'extension-netresearch-textdb',
        'path'           => '/module/netresearch/textdb',
        // labels, routes, ...
    ],
];
```

The top-level groups are defined in `EXT:core/Configuration/Backend/Modules.php`. TYPO3 v14 renamed three of them and declares the v13 name as an alias (`'aliases' => ['web']` and so on); `site` and `system` kept their names:

| v14 identifier | v13 identifier | Core modules in it (examples) |
|---|---|---|
| `content` | `web` (alias in v14) | `web_layout`, `records`, `content_status` |
| `media` | `file` (alias in v14) | modules that navigate the file storage tree |
| `site` | `site` | `site_configuration`, `pagetsconfig`, `link_management` |
| `admin` | `tools` (alias in v14) | admin tools; `integrations` is a submodule of `admin` |
| `system` | `system` | `content_security_policy` |

`user` and `help` are top-level groups as well, but are not rendered in the module menu (`renderInModuleMenu => false`).

Which identifier to write in `'parent'`:

- Extension requires `^14.3` only: the v14 identifier, e.g. `'parent' => 'content'` (the reference extensions).
- Extension supports `^13.4 || ^14.3`: the v13 identifier, e.g. `'parent' => 'web'`. TYPO3 v13.4 knows only `web`, and v14 rewrites a `parent`, `position.before` or `position.after` that names an alias to the v14 identifier before it builds the module tree (`ModuleFactory::adaptAliasMappingFromModuleConfiguration()`, called from `EXT:backend` `ServiceProvider::getModuleRegistry()`).

When moving a module out of a former Netresearch group, keep its identifier and `path`: backend group permissions and bookmarks refer to them. Remove the extension's own copy of the group entry, its labels file (`locallang_mod.xlf` and translations) and its icon registration (each Netresearch extension registered its own copy, so removing one does not hide the modules of another), and update every document that names the "Netresearch" group (README, `Documentation/`, screenshots).

### Icon registration

Register the module icon, like the record icons, with `SvgSpriteIconProvider`, the provider core uses for all of its own icons. The SVG wraps its paths in a `<symbol>` whose id is the icon identifier (core names its module sprites the same way, e.g. `module.svg#module-web`), followed by a `<use>` of that symbol so the file also renders when opened on its own:

```php
// Configuration/Icons.php
use TYPO3\CMS\Core\Imaging\IconProvider\SvgSpriteIconProvider;

return [
    'extension-netresearch-textdb' => [
        'provider' => SvgSpriteIconProvider::class,
        'sprite'   => 'EXT:nr_textdb/Resources/Public/Icons/Module.svg#extension-netresearch-textdb',
    ],
];
```

```xml
<!-- Resources/Public/Icons/Module.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 64 64">
    <symbol id="extension-netresearch-textdb" viewBox="0 0 64 64">
        <path fill="currentColor" d="..."/>
        <path fill="var(--nr-icon-accent, #2F99A4)" fill-rule="evenodd" d="..."/>
    </symbol>
    <use href="#extension-netresearch-textdb"/>
</svg>
```

Why the sprite provider: TYPO3 v14.3 renders an icon in the markup the template asks for, and the two SVG providers differ in one of them.

- **Inline markup.** The module menu (`EXT:backend/Resources/Private/Partials/Backend/ModuleMenu.fluid.html`), the submodule overview cards (`Templates/SubmoduleOverview/Cards.fluid.html`) and the user toolbar dropdown request `alternativeMarkupIdentifier="inline"`. `SvgSpriteIconProvider::generateInlineMarkup()` returns `<svg class="icon-color"><use xlink:href="..."/></svg>` when no `source` is registered; `SvgIconProvider` embeds the sanitized SVG. Both follow the colour scheme here.
- **Default markup.** A template without `alternativeMarkupIdentifier` gets the default markup. `SvgSpriteIconProvider` renders the same `<svg><use>`, and `currentColor` inherits through `<use>`. `SvgIconProvider` renders `<img src="...">`, where `currentColor` resolves in the image's own document, so the glyph does not follow the colour scheme. In v14.3 the About module's module cards (`Partials/About/Modules.fluid.html`) render module icons this way.

Do not add a `source` next to `sprite`: the sprite provider then inlines that file for the inline markup instead of using the sprite. The reference extensions pin in a functional test that both markups of the module icon are `<svg><use>` of the sprite and never `<img>`.

### Accent colour

The reference icons draw the feature glyph in `fill="currentColor"` and the turquoise accent as `fill="var(--nr-icon-accent, #2F99A4)"`, both as presentation attributes. Neither TYPO3 nor the reference extensions set `--nr-icon-accent`, so the accent always renders the fallback `#2F99A4`, the turquoise the "Module Icon" section names. The custom property gives a backend stylesheet one place to change the accent of the module icons, which `<use>` draws in the page's context; an icon rendered as `<img>` does not see the page's custom properties and always keeps the fallback.

## Description Field Requirements

**CRITICAL:** Both `composer.json` and `ext_emconf.php` description fields MUST mention the company name.

**Format:** `<What extension does> - by Netresearch` or include "Netresearch" naturally in the description.

**Examples:**
```
✅ "Adds image support to CKEditor5 - by Netresearch"
✅ "Netresearch extension for image handling in CKEditor5"
✅ "Image support for CKEditor5 RTE. Developed and maintained by Netresearch DTT GmbH."

❌ "Adds image support to CKEditor5"  (missing company name)
❌ "Image extension"  (too vague, missing company name)
```

**Why this matters:**
- Brand visibility in extension listings
- Clear attribution in TYPO3 Extension Repository (TER)
- Professional identification in Packagist search results

## composer.json Requirements

**All Netresearch extensions MUST include:**

```json
{
    "name": "netresearch/<extension-name>",
    "type": "typo3-cms-extension",
    "description": "<Clear description> - by Netresearch",
    "homepage": "https://github.com/netresearch/<repo-name>",
    "license": "AGPL-3.0-or-later",
    "authors": [
        {
            "name": "<Developer Name>",
            "email": "typo3@netresearch.de",
            "role": "Developer",
            "homepage": "https://www.netresearch.de/"
        }
    ],
    "extra": {
        "typo3/cms": {
            "extension-key": "<extension_key>"
        }
    }
}
```

**Mandatory Fields:**
| Field | Format | Example |
|-------|--------|---------|
| `name` | `netresearch/<dashed-extension-key>` | `netresearch/rte-ckeditor-image` |
| `description` | Must mention "Netresearch" | `Image support for CKEditor5 - by Netresearch` |
| `homepage` | GitHub repository URL | `https://github.com/netresearch/t3x-rte_ckeditor_image` |
| `license` | SPDX identifier | `AGPL-3.0-or-later`, or `GPL-2.0-or-later` beside GPL-2.0-only code — see "Licensing by artifact type" in `SKILL.md` |
| `authors[].email` | Netresearch TYPO3 email | `typo3@netresearch.de` |
| `authors[].homepage` | Company website | `https://www.netresearch.de/` |

## ext_emconf.php Requirements

**All Netresearch extensions MUST include:**

```php
<?php
$EM_CONF[$_EXTKEY] = [
    'title'          => '<Extension Title>',
    'description'    => '<Clear description> - by Netresearch',
    'category'       => '<be|fe|plugin|misc>',
    'author'         => '<Developer Name(s)>',
    'author_email'   => 'typo3@netresearch.de',
    'author_company' => 'Netresearch DTT GmbH',
    'state'          => 'stable',
    'version'        => '<x.y.z>',
    'constraints'    => [
        'depends' => [
            'php'   => '<min>-<max>',
            'typo3' => '<min>-<max>',
        ],
        'conflicts' => [],
        'suggests'  => [],
    ],
];
```

**Mandatory Fields:**
| Field | Value | Notes |
|-------|-------|-------|
| `description` | Must mention "Netresearch" | Include company name in description text |
| `author_company` | `Netresearch DTT GmbH` | **Exact spelling required** |
| `author_email` | `*@netresearch.de` | Must use Netresearch email domain |
| `author` | Developer name(s) | Comma-separated for multiple |

## Configuration Files Checklist

**When creating or auditing a Netresearch TYPO3 extension:**

1. **Extension Icon**
   - [ ] `Resources/Public/Icons/Extension.svg` exists
   - [ ] Either the feature tile: turquoise `#2F99A4` tile, white `#FFFFFF` feature glyph, orange `#FF4D00` marker dot
   - [ ] Or the official Netresearch symbol-only logo: Frame `#2F99A4`, Letter `#585961`

2. **composer.json**
   - [ ] `name` starts with `netresearch/`
   - [ ] `description` mentions "Netresearch"
   - [ ] `homepage` points to GitHub repository
   - [ ] `authors[].homepage` is `https://www.netresearch.de/`
   - [ ] `authors[].email` uses `@netresearch.de` domain
   - [ ] `license` is specified (AGPL-3.0-or-later recommended)

3. **ext_emconf.php**
   - [ ] `description` mentions "Netresearch"
   - [ ] `author_company` is exactly `Netresearch DTT GmbH`
   - [ ] `author_email` uses `@netresearch.de` domain
   - [ ] `author` lists developer name(s)
   - [ ] All mandatory fields are populated

4. **LICENSE file**
   - [ ] LICENSE or LICENSE.txt exists in extension root
   - [ ] Contains full license text matching composer.json license

5. **Backend modules** (if any; TYPO3 v14)
   - [ ] Every entry in `Configuration/Backend/Modules.php` has a `parent`: a core group, or another module of the extension for its third-level modules; no `netresearch_module` group
   - [ ] Module icon glyph in `currentColor`, accent turquoise `#2F99A4` (the reference extensions write it as `var(--nr-icon-accent, #2F99A4)`, see "Module Placement and Icon Registration")

6. **README.md**
   - [ ] Mentions "Netresearch DTT GmbH" in credits/author section
   - [ ] Links to https://www.netresearch.de/
   - [ ] Follows badge ordering standard (see below)
   - [ ] Includes required security badges

## README Badge Standards

**All Netresearch TYPO3 extension READMEs MUST follow this badge ordering:**

### Badge Order Template

```markdown
<!-- Row 1: CI/Quality badges -->
[![CI](https://github.com/netresearch/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/netresearch/REPO/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/netresearch/REPO/graph/badge.svg)](https://codecov.io/gh/netresearch/REPO)

<!-- Row 2: Security badges (REQUIRED for production extensions) -->
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/netresearch/REPO/badge)](https://securityscorecards.dev/viewer/?uri=github.com/netresearch/REPO)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/PROJECT_ID/badge)](https://www.bestpractices.dev/projects/PROJECT_ID)
[![SLSA 3](https://slsa.dev/images/gh-badge-level3.svg)](https://slsa.dev)

<!-- Row 3: Standards badges -->
[![PHPStan](https://img.shields.io/badge/PHPStan-level%2010-brightgreen.svg)](https://phpstan.org/)
[![PHP 8.x+](https://img.shields.io/badge/PHP-8.5%2B-blue.svg)](https://www.php.net/)
[![TYPO3 v14](https://img.shields.io/badge/TYPO3-v14-orange.svg)](https://typo3.org/)
[![License](https://img.shields.io/github/license/netresearch/REPO)](https://github.com/netresearch/REPO/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/netresearch/REPO)](https://github.com/netresearch/REPO/releases)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-3.0-4baaaa.svg)](CODE_OF_CONDUCT.md)

<!-- Row 4: TYPO3 TER badges (if published to TER) -->
![Composer](https://typo3-badges.dev/badge/EXT_KEY/composer/shields.svg)
![Downloads](https://typo3-badges.dev/badge/EXT_KEY/downloads/shields.svg)
![Extension](https://typo3-badges.dev/badge/EXT_KEY/extension/shields.svg)
![Stability](https://typo3-badges.dev/badge/EXT_KEY/stability/shields.svg)
![TYPO3](https://typo3-badges.dev/badge/EXT_KEY/typo3/shields.svg)
![Version](https://typo3-badges.dev/badge/EXT_KEY/version/shields.svg)
<!-- Generated with 🧡 at typo3-badges.dev -->
```

### Badge Categories

| Category | Badges | Required |
|----------|--------|----------|
| **CI/Quality** | CI workflow, codecov | ✅ Yes |
| **Security** | OpenSSF Scorecard, Best Practices, SLSA | ✅ Production |
| **Standards** | PHPStan, PHP version, TYPO3 version, License | ✅ Yes |
| **TER** | typo3-badges.dev badges | If on TER |

### Security Badge Requirements

**Production-ready extensions MUST have:**

| Badge | Source | How to Get |
|-------|--------|------------|
| OpenSSF Scorecard | Auto-generated | Enable `.github/workflows/scorecard.yml` |
| OpenSSF Best Practices | Manual registration | Register at bestpractices.dev |
| SLSA 3 | CI workflow | Enable `.github/workflows/slsa-provenance.yml` |

**Getting OpenSSF Best Practices Badge:**
1. Go to https://www.bestpractices.dev/
2. Sign in with GitHub
3. Add your project
4. Complete the questionnaire
5. Copy the badge URL with your PROJECT_ID

### TYPO3 TER Badges

**For extensions published to TYPO3 Extension Repository:**

Generate badges at https://typo3-badges.dev/ using your extension key.

```markdown
![Composer](https://typo3-badges.dev/badge/rte_ckeditor_image/composer/shields.svg)
![Downloads](https://typo3-badges.dev/badge/rte_ckeditor_image/downloads/shields.svg)
![Extension](https://typo3-badges.dev/badge/rte_ckeditor_image/extension/shields.svg)
![Stability](https://typo3-badges.dev/badge/rte_ckeditor_image/stability/shields.svg)
![TYPO3](https://typo3-badges.dev/badge/rte_ckeditor_image/typo3/shields.svg)
![Version](https://typo3-badges.dev/badge/rte_ckeditor_image/version/shields.svg)
<!-- Generated with 🧡 at typo3-badges.dev -->
```

### Real-World Examples

**t3x-rte_ckeditor_image (gold standard):**
- All 4 badge rows present
- OpenSSF Scorecard + Best Practices + SLSA
- 6 TYPO3 TER badges

**t3x-nr-llm (good):**
- 3 badge rows (no TER badges - not published to TER)
- OpenSSF Scorecard + Best Practices + SLSA

**t3x-cowriter (good):**
- 3 badge rows (CI/Quality, Standards, TER)
- Missing security badges (backlog - requires enrollment)
- TER badges present ✅

## Documentation Branding (docs.typo3.org)

Use [Hosted TYPO3 Manual Branding](typo3-docs-branding.md) for the complete
profile: official TYPO3 theme and fonts, teal decorative underlines, native
responsive navigation cards, a Netresearch closing card, localized assets and
full renderer/browser verification. Inspect nr-llm's current source and rendered
manual as the reference. The standalone-page header-logo and font rules do not
apply to these manuals.

**Documentation license**: CC BY 4.0 (separate from code license).

### guides.xml Required Attributes

All Netresearch extensions MUST configure these in `Documentation/guides.xml`:

```xml
<extension
    class="\T3Docs\Typo3DocsTheme\DependencyInjection\Typo3DocsThemeExtension"
    project-home="https://github.com/netresearch/REPO"
    project-contact="https://github.com/netresearch/REPO/discussions"
    project-repository="https://github.com/netresearch/REPO"
    project-issues="https://github.com/netresearch/REPO/issues"
    project-discussions="https://github.com/netresearch/REPO/discussions"
    edit-on-github="netresearch/REPO"
    edit-on-github-branch="main"
    edit-on-github-directory="Documentation"
    interlink-shortcode="netresearch/PACKAGE"
/>
```

**NEVER** use `mailto:` for `project-contact`. Use GitHub Discussions or Issues.

## Validation Commands

```bash
# Check composer.json vendor
jq -r '.name' composer.json | grep -q "^netresearch/" && echo "✅ Correct vendor" || echo "❌ Wrong vendor"

# Check composer.json description mentions Netresearch
jq -r '.description' composer.json | grep -qi "netresearch" && echo "✅ Description mentions Netresearch" || echo "❌ Description missing Netresearch"

# Check author homepage
jq -r '.authors[].homepage' composer.json | grep -q "netresearch.de" && echo "✅ Correct homepage" || echo "❌ Wrong homepage"

# Check ext_emconf.php description mentions Netresearch
grep "'description' =>" ext_emconf.php | grep -qi "netresearch" && echo "✅ Description mentions Netresearch" || echo "❌ Description missing Netresearch"

# Check ext_emconf.php author_company
grep -q "'author_company' => 'Netresearch DTT GmbH'" ext_emconf.php && echo "✅ Correct company" || echo "❌ Wrong company"

# Check extension icon exists
test -f Resources/Public/Icons/Extension.svg && echo "✅ Extension icon exists" || echo "❌ Missing extension icon"
```
