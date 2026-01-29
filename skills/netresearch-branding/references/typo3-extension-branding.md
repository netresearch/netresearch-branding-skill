# TYPO3 Extension Branding

**Purpose:** Ensure consistent Netresearch branding across all TYPO3 extensions developed by or for Netresearch.

## Extension Icon

**Standard:** Use the Netresearch symbol-only logo as the extension icon.

**File Location:** `Resources/Public/Icons/Extension.svg`

**SVG Source:**
```xml
<svg id="netresearch-logo" data-name="Netresearch Logo" xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 300 300">
    <defs>
        <style>
            .nr-frame{fill:#2999a4;}
            .nr-letter{fill:#595a62;}
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
- Frame (brackets): Turquoise `#2999A4`
- Letter "n": Anthracite Grey `#595A62`

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
| `license` | SPDX identifier | `AGPL-3.0-or-later` or `GPL-2.0-or-later` |
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
   - [ ] Uses official Netresearch symbol-only logo
   - [ ] Colors: Frame `#2999A4`, Letter `#595A62`

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

5. **README.md**
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
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](CODE_OF_CONDUCT.md)

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

**t3x-cowriter (needs update):**
- Missing security badges ❌
- Missing TER badges ❌
- Inconsistent ordering ❌

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
