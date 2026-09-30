<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
<!-- SPDX-FileCopyrightText: Netresearch DTT GmbH -->

# Security assurance case — netresearch-branding-skill

This document states what a user can expect from this repository in terms of security, and argues why that expectation holds. Every claim names the file that implements it. Reporting a vulnerability: see the [security policy](https://github.com/netresearch/.github/blob/main/SECURITY.md).

## What the repository ships

| Part | Files | Runs where |
| --- | --- | --- |
| Skill content: brand rules and references for an AI agent | `skills/netresearch-branding/SKILL.md`, `skills/netresearch-branding/references/*.md`, `outputStyles/*.md` | Read by the agent as instructions; not executed |
| Templates and assets | `skills/netresearch-branding/templates/`, `skills/netresearch-branding/assets/`, `examples/components.html`, `site/` | Copied into the user's project, or published as the GitHub Pages site by `.github/workflows/pages.yml` |
| Contrast audit | `skills/netresearch-branding/scripts/contrast-audit.cjs` | On the user's machine or in CI, on the user's request |
| Repository checks | `Build/Scripts/check-brand-colours.py`, `Build/Scripts/check-plugin-version.sh`, `Build/hooks/pre-push`, `scripts/verify-harness.sh` | On contributors' machines (the pre-push hook runs `check-plugin-version.sh`, the others are run by hand); `check-brand-colours.py` also in this repository's CI (`brand-colours.yml`) |

The skill has no server component, stores no data, and handles no user accounts.

## Security requirements

1. The contrast audit sends a credential given with `--header` only to the target's own origin, only over a connection whose TLS certificate was verified, and over plain `http` only to a loopback host.
2. The contrast audit does not trust an invalid certificate for the page or any subresource unless the user asks for it explicitly.
3. The brand-colour check reads repository files as data and never executes them or fetches anything they reference.
4. Nothing committed to the repository contains a secret.
5. The checks of a pull request fail when it adds a dependency with a known high or critical vulnerability, or introduces a static-analysis finding of severity WARNING or higher.

## Actors and trust boundaries

- **Skill user and agent.** The agent reads the Markdown files as instructions. Text in this repository is therefore trusted input to the agent; changes to it go through pull request review like code (see [Governance](https://github.com/netresearch/.github/blob/main/GOVERNANCE.md)).
- **Audited page (untrusted).** `contrast-audit.cjs` loads a local file or URL chosen by the user in headless Chromium through `playwright-core` and runs the page's own scripts. Playwright launches Chromium without its sandbox by default (`chromiumSandbox` defaults to `false` in playwright-core 1.63.0), and the script does not enable it. Audit a page you do not trust only inside a disposable container or CI runner.
- **Network peers of the audit.** The page and every subresource it loads are fetched over the network. The TLS boundary is enforced by Chromium's certificate verification (requirements 1 and 2).
- **Repository files read by the checks.** `check-brand-colours.py` parses tracked CSS, SVG, HTML, Markdown, JSON and YAML files, including files from a pull request.
- **CI.** Workflows run on GitHub-hosted runners with `permissions: {}` at the top level and the minimum job permissions each reusable workflow needs (`.github/workflows/*.yml`).

## Threats and countermeasures

| Threat | Countermeasure | Evidence |
| --- | --- | --- |
| A credential passed with `--header` reaches a man-in-the-middle (CWE-295, CWE-319) | Certificate verification is on for the page and all subresources; `--insecure` turns it off and is refused together with `--header` before the browser starts | `contrast-audit.cjs` (`ignoreHTTPSErrors: insecure` and the check after argument parsing); `scripts/tests/contrast-audit-tls.test.cjs` runs the audit against a self-signed HTTPS server and asserts that no request and no `Authorization` header reaches it |
| A credential passed with `--header` reaches a third-party origin the page loads from, directly or through a redirect (CWE-200) | The header is added per request, through Chromium's Fetch interception, only when the request's origin equals the target's origin; each redirect hop is checked again | `contrast-audit.cjs` (`sendHeaderToOriginOnly`); `scripts/tests/contrast-audit-headers.test.cjs` asserts that a second origin, loaded directly and through a redirect from the target, receives its requests without the header while the target receives it |
| A credential passed with `--header` crosses the network unencrypted (CWE-319) | `--header` with an `http://` target is refused unless the host is `localhost`, `127.0.0.1` or `[::1]` | `contrast-audit.cjs` (the check after argument parsing); `contrast-audit-headers.test.cjs` |
| An unstyled page passes the audit because a stylesheet failed to load | A failed stylesheet or script request, including one rejected for its certificate, fails the run with exit 1 | `contrast-audit.cjs` (`requestfailed` and `response` handlers); covered by the subresource case of `contrast-audit-tls.test.cjs` |
| A measurement error is swallowed and the audit reports success | Protocol errors other than a detached node are collected and rethrown | `contrast-audit.cjs` (`measureOneNode`, `measureInteractiveStates`); `scripts/tests/contrast-audit-error-paths.test.cjs` |
| Malicious page script attacks the machine running the audit | Not countered by the script: Chromium runs without its sandbox (see trust boundaries). Mitigation is operational: run untrusted pages in a container | — |
| XML entity expansion in an SVG exhausts memory (CWE-776) | SVG is parsed only with libexpat 2.4.0 or later, whose amplification limit is on by default; with an older libexpat the script refuses to read SVG | `Build/Scripts/check-brand-colours.py` (`EXPAT_PROTECTED`) |
| An SVG references an external entity to read a local file or URL (CWE-611) | External entities and DTDs are parsed as empty and never opened | `Build/Scripts/check-brand-colours.py` (`svg_colours`, `_empty_external_entity`) |
| YAML in a pull request instantiates arbitrary Python objects (CWE-502) | YAML is loaded with a `SafeLoader` subclass | `Build/Scripts/check-brand-colours.py` (`_TaggedSafeLoader`) |
| Shell injection through file names (CWE-78) | `git ls-files -z` runs from an argument list without a shell; paths are NUL-separated | `Build/Scripts/check-brand-colours.py` (`tracked_files`) |
| A secret is committed | Betterleaks scans every push to `main` and every pull request to `main` | `.github/workflows/security.yml` |
| A vulnerable or malicious dependency is added | Dependency review fails on high or critical vulnerabilities in a pull request; Composer Audit fails on known PHP advisories; Renovate proposes updates | `.github/workflows/security.yml`, `renovate.json` |
| Insecure code or workflow patterns | Opengrep fails a pull request on findings of severity WARNING or higher; zizmor analyses the workflows | `.github/workflows/security.yml` |
| A dependency version drifts between runs | Python dependencies of `check-brand-colours.py` are pinned in its inline script metadata; `playwright-core` is pinned in `package.json` | `Build/Scripts/check-brand-colours.py`, `package.json` |

## Secure design principles applied

- **Secure defaults:** TLS verification is on unless `--insecure` is given (`contrast-audit.cjs`).
- **Least privilege:** workflows declare `permissions: {}` and grant each job only what its reusable workflow needs (`.github/workflows/*.yml`).
- **Fail closed:** the audit exits non-zero when it cannot load a stylesheet or script or cannot finish a measurement; the brand-colour check reports a file it cannot decode instead of skipping it (`check-brand-colours.py`, `main`).
- **Minimal attack surface:** the skill is static content; the only executable code runs on explicit invocation.

## What a user cannot expect

- The contrast audit is not a sandbox. It runs the audited page's scripts in an unsandboxed Chromium.
- A `--header` value is sent unencrypted to an `http://` target on a loopback host (`localhost`, `127.0.0.1`, `[::1]`).
- The templates load fonts from Google Fonts (`skills/netresearch-branding/templates/landing-page.html`). A project that must not contact third parties has to self-host the fonts.
- The contrast audit measures text contrast (WCAG SC 1.4.3). It is not a security scanner for the audited page.
