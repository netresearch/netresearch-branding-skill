# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: Netresearch DTT GmbH
# /// script
# requires-python = ">=3.11"
# dependencies = ["PyYAML==6.0.3"]
# ///
"""Exercise the actual page-branding checkpoint scripts against both profiles."""

import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[3]
CHECKPOINTS = REPO / "skills/netresearch-branding/checkpoints.yaml"
GENERATOR = '<meta content="phpdocumentor/guides" name="generator">'
THEME = (
    '<link href="https://cdn.typo3.com/typo3documentation/theme/'
    'typo3-docs-theme/0.47.2/css/theme.css" rel="stylesheet">'
)
HOSTED_BODY = """<header>TYPO3 Documentation</header>
<main><div class="card">[n] A Netresearch extension
<p>Netresearch DTT GmbH</p><a href="https://www.netresearch.de/">Website</a>
</div></main><footer>TYPO3 platform footer</footer>"""
STANDALONE = """<html><head><title>Project</title></head><body>
<header><img src="netresearch-symbol-only.svg" alt="Netresearch"></header>
<footer>
Netresearch DTT GmbH
<a href="https://www.netresearch.de/">Website</a>
</footer></body></html>"""


def document(head: str, body: str = HOSTED_BODY) -> str:
    return f"<html>\n<head>\n{head}\n</head>\n<body>{body}</body></html>\n"


class PageBrandingProfiles(unittest.TestCase):
    def test_actual_checkpoint_scripts(self) -> None:
        records = yaml.safe_load(CHECKPOINTS.read_text())["mechanical"]
        scripts = {
            item["id"]: item["command"]
            for item in records
            if item["id"] in {"NB-17", "NB-18", "NB-19"}
        }
        self.assertEqual(set(scripts), {"NB-17", "NB-18", "NB-19"})
        hosted = document(f"{GENERATOR}\n{THEME}")
        invalid = document("<title>Unbranded standalone</title>")
        cases = {
            "hosted": ([hosted], 0),
            "standalone-valid": ([STANDALONE], 0),
            "standalone-invalid": ([invalid], 1),
            "generator-without-theme": ([document(GENERATOR)], 1),
            "theme-without-generator": ([document(THEME)], 1),
            "description-is-not-generator": (
                [document(f"{GENERATOR.replace('generator', 'description')}\n{THEME}")],
                1,
            ),
            "generator-attribute-order": (
                [
                    document(
                        f'<meta name="generator" content="phpdocumentor/guides">\n{THEME}'
                    )
                ],
                0,
            ),
            "body-markers-only": (
                [document("", f"{GENERATOR}{THEME}{HOSTED_BODY}")],
                1,
            ),
            "hosted-does-not-mask-invalid-page": ([hosted, invalid], 1),
            "mixed-valid-profiles": ([hosted, STANDALONE], 0),
        }
        for case, (pages, expected) in cases.items():
            with self.subTest(case=case), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                for number, html in enumerate(pages):
                    page = root / "docs" / f"manual-{number}" / "index.html"
                    page.parent.mkdir(parents=True)
                    page.write_text(html)
                for checkpoint, script in scripts.items():
                    with self.subTest(checkpoint=checkpoint):
                        result = subprocess.run(
                            ["bash", "-c", script],
                            cwd=root,
                            capture_output=True,
                            text=True,
                            check=False,
                        )
                        self.assertEqual(
                            result.returncode,
                            expected,
                            msg=f"{checkpoint}: {result.stderr}",
                        )


if __name__ == "__main__":
    unittest.main()
