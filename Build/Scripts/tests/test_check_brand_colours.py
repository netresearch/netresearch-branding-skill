#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "coloraide==8.13",
#   "markdown-it-py==4.2.0",
#   "pyyaml==6.0.3",
#   "tinycss2==1.5.1",
# ]
# ///
"""Tests for Build/Scripts/check-brand-colours.py.

Run from the repository root: `uv run Build/Scripts/tests/test_check_brand_colours.py`.
The dependency block above must equal the script's; a test enforces that.
"""

from __future__ import annotations

import importlib.util
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "Build" / "Scripts" / "check-brand-colours.py"

sys.dont_write_bytecode = True  # keep Build/Scripts free of __pycache__
_spec = importlib.util.spec_from_file_location("check_brand_colours", SCRIPT)
assert _spec and _spec.loader
guard = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(guard)

SVG = '<svg xmlns="http://www.w3.org/2000/svg">{}</svg>'

# One near miss per notation and file type. Every case was a miss of the
# first version of the guard except the first five.
NEAR_MISSES = {
    "svg fill hex": ("a.svg", SVG.format('<path fill="#2999a4" d="M0 0h1v1z"/>')),
    "svg stroke": ("b.svg", SVG.format('<path stroke="#2F99A5" d="M0 0h1v1z"/>')),
    "svg stop-color": (
        "c.svg",
        SVG.format('<linearGradient><stop stop-color="#2999a4"/></linearGradient>'),
    ),
    "svg style attribute": (
        "d.svg",
        SVG.format('<path style="fill:#595a62" d="M0 0h1v1z"/>'),
    ),
    "css custom property": ("e.css", ":root{--nr-primary:#2999A4}"),
    "css hex3 #39a": ("f.css", ".x{color:#39a}"),
    "css hex3 #556": ("g.css", ".x{color:#556}"),
    "css hex3 #f50": ("h.css", ".x{color:#f50}"),
    "css hex8": ("i.css", ".x{color:#2999a4ff}"),
    "css rgb()": ("j.css", ".x{color:rgb(41,153,164)}"),
    "css rgba()": ("k.css", ".x{color:rgba(89, 90, 98, .9)}"),
    "css hsl()": ("l.css", ".x{color:hsl(186, 60%, 40%)}"),
    "css -rgb triple": ("m.css", ":root{--nr-primary-rgb: 41, 153, 164;}"),
    "svg rgb() in fill": (
        "n.svg",
        SVG.format('<path fill="rgb(41,153,164)" d="M0 0h1v1z"/>'),
    ),
    "html style element": ("o.html", "<!doctype html><style>.x{color:#2999a4}</style>"),
    "html style attribute": ("p.html", '<!doctype html><p style="color:#2999a4">x</p>'),
    "md fenced css": ("q.md", "```css\n:root{--nr-primary:#2999a4}\n```\n"),
    "yaml value": ("r.yaml", 'primary: "#2999a4"\n'),
    "json value": ("s.json", '{"primary": "#2999a4"}'),
    "scss variable": ("t.scss", "$nr-primary: #2999a4;\n"),
    "md fenced html": ("u.md", '```html\n<p style="color:#595a62">x</p>\n```\n'),
    "css space syntax rgb()": ("v.css", ".x{color:rgb(41 153 164 / 50%)}"),
    # dE00 0.68 but channel distance 9: only the CIEDE2000 half catches it.
    "delta-e only #FF4D09": ("w.css", ".x{color:#FF4D09}"),
}

PASSES = {
    "documented variant #4D4F57": ("a.css", ".x{color:#4D4F57}"),
    "lowercase exact #2f99a4": ("b.css", ".x{color:#2f99a4}"),
    "exact brand with alpha": ("c.css", ".x{color:rgba(47,153,164,.1)}"),
    "exact triple": ("d.css", ":root{--nr-primary-rgb: 47, 153, 164;}"),
    "svg comment": ("e.svg", SVG.format("<!-- was #2999a4 -->")),
    "css comment": ("f.css", "/* was #2999a4 */"),
    "html script": ("g.html", '<script>var old = "#2999a4";</script>'),
    "colour inside a longer json string": (
        "h.json",
        '{"prompt": "fix $primary: #2e98a3;"}',
    ),
    "md fence of another language": ("i.md", "```js\nconst c = '#2999a4';\n```\n"),
    "md prose": ("j.md", "The old value was #2999a4.\n"),
    "white variant": ("k.svg", SVG.format('<path fill="#FFFFFF" d="M0 0h1v1z"/>')),
}


class NearMisses(unittest.TestCase):
    def test_each_notation_is_reported(self) -> None:
        for name, (path, text) in NEAR_MISSES.items():
            with self.subTest(name):
                count, findings = guard.findings_in(path, text)
                self.assertEqual(len(findings), 1, findings)
                self.assertEqual(count, 1)

    def test_legitimate_values_pass(self) -> None:
        for name, (path, text) in PASSES.items():
            with self.subTest(name):
                self.assertEqual(guard.findings_in(path, text)[1], [])

    def test_either_metric_half_flags(self) -> None:
        # channel distance 8, dE00 above 2: the channel half flags it
        self.assertIsNotNone(guard.near_miss("#2F99AC"))
        self.assertGreaterEqual(_delta_e("#2F99AC", "#2F99A4"), guard.DELTA_E)
        # channel distance 9, dE00 below 2: the dE00 half flags it
        self.assertIsNotNone(guard.near_miss("#FF4D09"))
        # channel distance 9, dE00 above 2: neither half
        self.assertIsNone(guard.near_miss("#2F99AD"))


class RealFiles(unittest.TestCase):
    def test_every_colours_md_value_passes(self) -> None:
        path = "skills/netresearch-branding/references/colors.md"
        text = (ROOT / path).read_text(encoding="utf-8")
        count, findings = guard.findings_in(path, text)
        self.assertEqual(findings, [])
        # Guard against a vacuous pass: the fenced blocks hold dozens of values.
        self.assertGreater(count, 50)
        # And every hex value anywhere in the file, prose and tables included.
        for value in set(re.findall(r"#[0-9A-Fa-f]{6}\b", text)):
            with self.subTest(value):
                self.assertIsNone(guard.near_miss(value))

    def test_deliberate_quotes_are_not_read(self) -> None:
        for path in ("evals/evals.json", "site/index.html", "site/favicon.svg"):
            with self.subTest(path):
                text = (ROOT / path).read_text(encoding="utf-8")
                self.assertEqual(guard.findings_in(path, text)[1], [])


class Header(unittest.TestCase):
    def test_dependency_pins_match_the_script(self) -> None:
        def block(p: pathlib.Path) -> str:
            text = p.read_text(encoding="utf-8")
            return text.split("# /// script", 1)[1].split("# ///", 1)[0]

        self.assertEqual(block(SCRIPT), block(pathlib.Path(__file__)))


def _delta_e(a: str, b: str) -> float:
    return guard.Color(a).delta_e(b, method="2000")


if __name__ == "__main__":
    unittest.main()
