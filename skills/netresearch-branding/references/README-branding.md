# Netresearch README Branding Requirements

Required headline and footer branding for every Netresearch repository
README — TYPO3 extensions, Claude skills, internal tools, anything
public or private under the Netresearch GitHub/GitLab orgs.

These rules are enforced by the `netresearch-branding` skill via
checkpoints **NB-04**, **NB-05**, and **NB-30..NB-33**.

## Why

Readers who land on a repo READ ONLY THE TOP — the badges, the project
description, maybe the "what is this" paragraph. They scan to the
bottom for license and credits. If the org affiliation is missing from
both ends, the project looks orphaned. Mentioning "Netresearch" once in
the middle of an `## About` section three screens down doesn't make it
discoverable.

The existing NB-04 (any mention of "Netresearch") and NB-05 (any
`netresearch.de` link anywhere in the file) catch the worst case —
total absence — but pass on a README where the only Netresearch
reference is buried in line 412. NB-30..NB-33 enforce **placement**:
visible at the top, visible at the bottom, with the legal license
mention near it.

## Required structure

### Headline (first 30 lines) — NB-30 (warning)

The first 30 lines must contain at least one of:

1. A link to `netresearch.de` (the regex matches the domain literally,
   so `https://www.netresearch.de/`, `<https://www.netresearch.de>`,
   and bare `netresearch.de` all qualify).
2. The string `Netresearch DTT` (the company short-name, with or
   without the `GmbH` suffix).
3. The phrase `by Netresearch` — the suffix used by the TYPO3
   extension `ext_emconf.php` description convention (`... - by
   Netresearch`).

Match is case-insensitive.

In practice this means one of:

- A badge linking to the org page (e.g. an "About" badge).
- A logo image whose alt-text or surrounding markdown contains the
  link.
- A one-line lead paragraph like
  `> Maintained by [Netresearch DTT GmbH](https://www.netresearch.de/).`
- The project description itself naming the company:
  `# rte-ckeditor-image — by Netresearch DTT GmbH`.
- TYPO3 extension descriptions ending with `- by Netresearch`.

The check is a single pipeline:

```bash
head -30 README.md | grep -qiE 'netresearch\.de|Netresearch DTT|by Netresearch'
```

### Footer (last 20 lines) — NB-31, NB-32

The last 20 lines must contain BOTH:

- **NB-31 (warning)**: the company name `Netresearch DTT` (with or
  without `GmbH`).
- **NB-32 (info)**: a link to `netresearch.de`.

A standard footer block looks like:

```markdown
## License

Code is licensed under [MIT](LICENSE-MIT).
Documentation and skill content are licensed under
[CC-BY-SA-4.0](LICENSE-CC-BY-SA-4.0).

Copyright (c) 2026 [Netresearch DTT GmbH](https://www.netresearch.de/).
```

That single Copyright line satisfies NB-31, NB-32, and (with the
license heading two lines up) NB-33 in one place.

### License mention — NB-33 (info)

The README must reference licensing somewhere. The check is
case-insensitive — matches `License`, `LICENSE`, `## License`,
`Licensed under`, SPDX badge URLs containing `/license/`, etc.:

```bash
grep -qi 'license' README.md
```

Real Netresearch repos use one of:

- `## License` heading near the bottom with a paragraph describing
  the licence and linking to `LICENSE` / `LICENSE-MIT` /
  `LICENSE-CC-BY-SA-4.0`.
- An SPDX shield/badge near the top
  (e.g. `![License](https://img.shields.io/github/license/netresearch/REPO)`)
  — this also satisfies NB-33 because the badge URL contains `license`.

## Examples

### Compliant — TYPO3 extension

```markdown
# rte-ckeditor-image

[![License](https://img.shields.io/github/license/netresearch/t3x-rte_ckeditor_image)](LICENSE)

Image support for CKEditor 5 in TYPO3 — by [Netresearch DTT GmbH](https://www.netresearch.de/).

...

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).

Copyright (c) 2026 [Netresearch DTT GmbH](https://www.netresearch.de/).
```

- NB-04 ✓ ("Netresearch" present)
- NB-05 ✓ (`netresearch.de` link)
- NB-30 ✓ (headline: `Netresearch DTT GmbH` and link in the lead line)
- NB-31 ✓ (footer: `Netresearch DTT`)
- NB-32 ✓ (footer: `netresearch.de`)
- NB-33 ✓ (`License` mentioned)

### Compliant — Claude skill / non-TYPO3 repo

```markdown
# Agent Harness Skill — by Netresearch DTT GmbH

[![Lint](https://github.com/netresearch/agent-harness-skill/actions/workflows/lint.yml/badge.svg)](https://github.com/netresearch/agent-harness-skill/actions/workflows/lint.yml)

A Claude Agent Skill for bootstrapping and verifying agent-harness
infrastructure. Maintained by [Netresearch DTT GmbH](https://www.netresearch.de/).

...

## License

Split licensing: code under [MIT](LICENSE-MIT), content under
[CC-BY-SA-4.0](LICENSE-CC-BY-SA-4.0).

Copyright (c) 2026 [Netresearch DTT GmbH](https://www.netresearch.de/).
```

All six checks pass.

### Non-compliant — common gaps

```markdown
# Agent Harness Skill                                  ← NB-30 FAIL

[![CI](.../badge.svg)](.../ci.yml)

A skill for bootstrapping agent-ready repos. ...      (no "Netresearch DTT", no netresearch.de link)

...

## Contributing
...

## License

Split licensing:
- Code: MIT
- Content: CC-BY-SA-4.0

Copyright (c) 2026 Netresearch DTT GmbH.              ← NB-32 FAIL (no netresearch.de link)
```

NB-30 fails because the headline mentions only "Agent Harness Skill" —
no `netresearch.de` link, no `Netresearch DTT`. NB-32 fails because the
footer copyright line doesn't link the company name to its website.

The minimal fix is two text changes:

```diff
-# Agent Harness Skill
+# Agent Harness Skill — by Netresearch DTT GmbH
```

```diff
-Copyright (c) 2026 Netresearch DTT GmbH.
+Copyright (c) 2026 [Netresearch DTT GmbH](https://www.netresearch.de/).
```

Both checks pass after that.

## Relationship to NB-04 / NB-05

NB-04 and NB-05 remain in place as broader baseline checks (any
mention of Netresearch / any `netresearch.de` link anywhere in the
README). NB-30..NB-32 are stricter overlays that require placement at
the top and bottom. A README that passes NB-30..NB-32 automatically
passes NB-04 and NB-05.

## Relationship to TYPO3 extension branding

For TYPO3 extensions, see `references/typo3-extension-branding.md`,
section "README Badge Standards", for the full badge ordering template
including required CI/Quality, Security (OpenSSF Scorecard, OpenSSF
Best Practices, SLSA), Standards (PHPStan, PHP version, TYPO3
version), and TER badges. The badge templates in that file are
already compatible with NB-30 — most include a license badge that
satisfies NB-33 and a description line that satisfies NB-30 if it
includes the `- by Netresearch` suffix.
