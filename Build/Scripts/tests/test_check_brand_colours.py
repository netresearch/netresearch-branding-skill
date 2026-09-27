"""Tests for Build/Scripts/check-brand-colours.py.

Run from the repository root, with the dependencies the script itself pins:

    uv run --no-project --with-requirements Build/Scripts/check-brand-colours.py \
        python -B Build/Scripts/tests/test_check_brand_colours.py

The pins live only in the script's PEP 723 block, which Renovate's pep723
manager updates. This file has no block of its own: config:recommended
ignores **/tests/**, so a copy here would never be bumped.
"""

from __future__ import annotations

import base64
import importlib.util
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "Build" / "Scripts" / "check-brand-colours.py"

sys.dont_write_bytecode = True  # keep Build/Scripts free of __pycache__
_spec = importlib.util.spec_from_file_location("check_brand_colours", SCRIPT)
assert _spec is not None
assert _spec.loader is not None
guard = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(guard)

SVG = '<svg xmlns="http://www.w3.org/2000/svg">{}</svg>'
# An SVG whose base64 contains "+" and ends in "==" padding.
LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#2999a4"/>>></svg>'
LOGO_B64 = base64.b64encode(LOGO_SVG.encode()).decode()
PLAIN_B64 = base64.b64encode(b'<svg><path fill="#2999a4" /></svg>').decode()
assert "+" in LOGO_B64
assert LOGO_B64.endswith("==")
assert PLAIN_B64.endswith("=")

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
    # Round 2 of the review: bypasses that are now covered.
    "scss rgba(hex, alpha)": ("x.scss", ".x{color:rgba(#2999a4, .5)}"),
    "color-mix literal argument": (
        "y.css",
        ".x{color:color-mix(in srgb, #2999a4 50%, white)}",
    ),
    "uppercase RGB()": ("z.css", ".x{color:RGB(41,153,164)}"),
    "css url(data:) svg, percent-encoded": (
        "a1.css",
        (
            ".x{background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E"
            "%3Cpath fill='%232999a4'/%3E%3C/svg%3E\")}"
        ),
    ),
    "css url(data:) svg, raw": (
        "a2.css",
        ".x{background:url('data:image/svg+xml;utf8,<svg><path fill=\"#2999a4\"/></svg>')}",
    ),
    "css url(data:) svg, base64": (
        "a3.css",
        ".x{background:url(data:image/svg+xml;base64,"
        + base64.b64encode(b'<svg><path fill="#2999a4"/></svg>').decode()
        + ")}",
    ),
    "svg: prefixed style": (
        "a4.svg",
        (
            '<svg:svg xmlns:svg="http://www.w3.org/2000/svg">'
            "<svg:style>.f{fill:#2999a4}</svg:style></svg:svg>"
        ),
    ),
    "svg animate values": (
        "a5.svg",
        SVG.format(
            '<rect><animate attributeName="fill" values="#2999a4;#2F99A4"/></rect>'
        ),
    ),
    "svg set to": (
        "a6.svg",
        SVG.format('<rect><set attributeName="fill" to="#2999a4"/></rect>'),
    ),
    "html bgcolor without #": ("a7.html", '<table><td bgcolor="2999a4">x</td></table>'),
    "html body text": ("a8.html", '<body text="#2999a4">x</body>'),
    "html body link": ("a9.html", '<body link="2999a4">x</body>'),
    "html meta theme-color": ("b1.html", '<meta name="theme-color" content="#2999a4">'),
    "html img shields badge": (
        "b2.html",
        '<img src="https://img.shields.io/badge/by-Netresearch-2999a4" alt="">',
    ),
    "md inline html": ("b3.md", 'Text <span style="color:#2999a4">x</span>\n'),
    "md html block": ("b4.md", '<div style="color:#2999a4">\n\nx\n\n</div>\n'),
    "md shields badge image": (
        "b5.md",
        "![b](https://img.shields.io/badge/by-Netresearch-2999a4)\n",
    ),
    "md shields badge ?color=": (
        "b6.md",
        "[x](https://img.shields.io/github/license/netresearch/REPO?color=2999a4)\n",
    ),
    "md fenced markdown with badge": (
        "b7.md",
        "```markdown\n[![N](https://img.shields.io/badge/by-Netresearch-2999a4)](https://x)\n```\n",
    ),
    "md fenced less": ("b8.md", "```less\n@p: #2999a4;\n```\n"),
    "md fenced json": ("b9.md", '```json\n{"primary": "#2999a4"}\n```\n'),
    "md fenced yaml": ("c1.md", '```yaml\nprimary: "#2999a4"\n```\n'),
    "scss $x-rgb triple": ("c2.scss", "$nr-primary-rgb: 41, 153, 164;\n"),
    "css -rgb space triple": ("c3.css", ":root{--nr-primary-rgb: 41 153 164;}"),
    # Round 3 of the review: shields.io forms that render #2999a4.
    "shields ?color=%23hex": (
        "d1.md",
        "![b](https://img.shields.io/badge/a-b-blue?color=%232999a4)\n",
    ),
    "shields path %23hex": (
        "d2.md",
        "![b](https://img.shields.io/badge/x-y-%232999a4)\n",
    ),
    "shields ?color=rgb()": (
        "d3.md",
        "![b](https://img.shields.io/badge/a-b-blue?color=rgb(41,153,164))\n",
    ),
    "shields ?labelColor=": (
        "d4.md",
        "![b](https://img.shields.io/badge/a-b-blue?labelColor=2999a4)\n",
    ),
    "shields ?logoColor=": (
        "d5.md",
        "![b](https://img.shields.io/badge/a-b-blue?logoColor=2999a4)\n",
    ),
    "shields legacy ?colorB=": (
        "d6.md",
        "![b](https://img.shields.io/badge/a-b-blue?colorB=2999a4)\n",
    ),
    # Round 3: data: SVG outside CSS.
    "html img src data: base64": (
        "e1.html",
        '<img src="data:image/svg+xml;base64,'
        + base64.b64encode(b'<svg><path fill="#2999a4"/></svg>').decode()
        + '" alt="">',
    ),
    "html img src data: percent-encoded": (
        "e2.html",
        '<img src="data:image/svg+xml,%3Csvg%3E%3Cpath fill=%22%232999a4%22/%3E%3C/svg%3E" alt="">',
    ),
    "svg image href data: base64": (
        "e3.svg",
        SVG.format(
            '<image href="data:image/svg+xml;base64,'
            + base64.b64encode(b'<svg><path fill="#2999a4"/></svg>').decode()
            + '"/>'
        ),
    ),
    "svg image xlink:href data: base64": (
        "e4.svg",
        SVG.format(
            '<image xlink:href="data:image/svg+xml;base64,'
            + base64.b64encode(b'<svg><path fill="#2999a4"/></svg>').decode()
            + '"/>'
        ),
    ),
    "yaml application tag": ("e6.yaml", 'primary: !brand "#2999a4"\n'),
    # Round 4: shields.io logo=, data: SVG in any attribute, padding, spaces.
    "shields ?logo=data: base64 with +": (
        "f1.md",
        "![b](https://img.shields.io/badge/a-b-blue?logo=data:image/svg%2bxml;base64,"
        + LOGO_B64.replace("+", "%2B")
        + ")\n",
    ),
    "shields ?logo= without data:, + as space": (
        "f2.html",
        '<img src="https://img.shields.io/badge/a-b-blue?logo=image/svg+xml;base64,'
        + LOGO_B64
        + '" alt="">',
    ),
    "html img srcset data:": (
        "f3.html",
        '<img srcset="data:image/svg+xml;base64,'
        + PLAIN_B64
        + ' 1x, other.png 2x" alt="">',
    ),
    "html source srcset data: second entry": (
        "f4.html",
        '<picture><source srcset="a.png 1x, data:image/svg+xml;base64,'
        + PLAIN_B64
        + ' 2x"></picture>',
    ),
    "html object data=": (
        "f5.html",
        '<object data="data:image/svg+xml;base64,' + PLAIN_B64 + '"></object>',
    ),
    "html body background=": (
        "f6.html",
        '<body background="data:image/svg+xml;base64,' + PLAIN_B64 + '">x</body>',
    ),
    "html video poster=": (
        "f7.html",
        '<video poster="data:image/svg+xml;base64,' + PLAIN_B64 + '"></video>',
    ),
    "svg image with another xlink prefix": (
        "f8.svg",
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/1999/xlink">'
        '<image x:href="data:image/svg+xml;base64,' + PLAIN_B64 + '"/></svg>',
    ),
    "html img src with surrounding spaces": (
        "f9.html",
        '<img src="  data:image/svg+xml;base64,' + PLAIN_B64 + '  " alt="">',
    ),
    "html img src unpadded base64": (
        "g1.html",
        '<img src="data:image/svg+xml;base64,' + PLAIN_B64.rstrip("=") + '" alt="">',
    ),
    "css url() unpadded base64": (
        "g2.css",
        '.x{background:url("data:image/svg+xml;base64,' + PLAIN_B64.rstrip("=") + '")}',
    ),
    "html img src unpadded base64 with whitespace inside": (
        "g7.html",
        '<img src="data:image/svg+xml;base64,'
        + PLAIN_B64[:20]
        + "\n"
        + PLAIN_B64[20:].rstrip("=")
        + '" alt="">',
    ),
    "html img srcset data: directly followed by a comma": (
        "g8.html",
        '<img srcset="data:image/svg+xml;base64,' + PLAIN_B64 + ', b.png 2x" alt="">',
    ),
    "css url() quoted with surrounding spaces": (
        "g9.css",
        '.x{background:url("  data:image/svg+xml;base64,' + PLAIN_B64 + '  ")}',
    ),
    "html body text= with spaces": ("g3.html", '<body text=" #2999a4 ">x</body>'),
    "html bgcolor= with a trailing space": ("g4.html", '<td bgcolor="2999a4 ">x</td>'),
    "shields ?color=%20%23hex": (
        "g5.md",
        "![b](https://img.shields.io/badge/a-b-blue?color=%20%232999a4)\n",
    ),
    "yaml tagged mapping": ("g6.yaml", 'x: !tag {c: "#2999a4"}\n'),
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
    "html script with a css-like object": (
        "l.html",
        "<script>y = {a: #2999a4}</script>",
    ),
    "exact brand badge": (
        "m.md",
        "![b](https://img.shields.io/badge/by-Netresearch-2F99A4)\n",
    ),
    "badge with a named colour": (
        "n.md",
        "![b](https://img.shields.io/badge/PHP-8.5-blue.svg)\n",
    ),
    "unparseable json fence": ("o.md", '```json\n{"primary": "#2999a4", ...}\n```\n'),
    "css string content": ("p.css", '.x::after{content:"#2999a4"}'),
    "badge on another host": ("q.md", "![b](https://example.org/badge/by-x-2999a4)\n"),
    # Round 3: text/link/vlink/alink are colours only on <body>.
    "md image with a data: SVG URL (renders as text)": (
        "v.md",
        "![x](data:image/svg+xml;base64,"
        + base64.b64encode(b'<svg><path fill="#2999a4"/></svg>').decode()
        + ")\n",
    ),
    "text= on a non-body element": ("r.html", '<p text="#2999a4">x</p>'),
    "link= on a non-body element": ("s.html", '<a link="2999a4" href="#">x</a>'),
    "shields named colour": ("t.md", "![b](https://img.shields.io/badge/a-b-orange)\n"),
    "bgcolor with a CSS name": ("u.html", '<td bgcolor="teal">x</td>'),
    "shields logo slug": (
        "w.md",
        "![b](https://img.shields.io/badge/a-b-blue?logo=github)\n",
    ),
    "srcset without data:": (
        "x.html",
        '<img srcset="a-2999a4.png 1x, b.png 2x" alt="">',
    ),
    "png data: URL in an attribute": (
        "y.html",
        '<img src="data:image/png;base64,iVBORw0KGgo=" alt="">',
    ),
}


class NearMisses(unittest.TestCase):
    def test_each_notation_is_reported(self) -> None:
        for name, (path, text) in NEAR_MISSES.items():
            with self.subTest(name):
                count, findings = guard.findings_in(path, text)
                self.assertEqual(len(findings), 1, findings)
                self.assertGreaterEqual(count, 1)

    def test_unparsed_colour_function_is_counted_and_walked(self) -> None:
        read, unparsed, findings = guard.scan("a.scss", ".x{color:rgba(#2999a4, .5)}")
        self.assertEqual((read, unparsed, len(findings)), (1, 1, 1))

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


class Round3(unittest.TestCase):
    def test_shields_named_colours_are_far_from_brand_colours(self) -> None:
        for name, value in guard.SHIELDS_NAMED_COLOURS.items():
            with self.subTest(name):
                self.assertIsNone(guard.near_miss(value))

    def test_shields_names_map_to_shields_values(self) -> None:
        # shields "orange" is #ea7233, CSS orange is #ffa500
        text = "![b](https://img.shields.io/badge/a-b-orange)\n"
        self.assertEqual(list(guard.colours_in(".md", text)), ["#ea7233"])

    def test_legacy_attributes_are_read_on_body_and_bgcolor(self) -> None:
        self.assertEqual(guard.scan("a.html", '<td bgcolor="teal">x</td>')[0], 1)
        self.assertEqual(guard.scan("b.html", '<body vlink="2F99A4">x</body>')[0], 1)
        self.assertEqual(guard.scan("c.html", '<p vlink="2F99A4">x</p>')[0], 0)

    def test_unparseable_json_is_a_finding_not_a_crash(self) -> None:
        read, unparsed, findings = guard.scan("a.json", '{"primary": "#2999a4",}')
        self.assertEqual((read, unparsed, len(findings)), (0, 0, 1))
        self.assertIn("does not parse", findings[0])

    def test_unparseable_yaml_is_a_finding_not_a_crash(self) -> None:
        read, unparsed, findings = guard.scan("a.yaml", "a: [1, 2\n")
        self.assertEqual((read, unparsed, len(findings)), (0, 0, 1))
        self.assertIn("does not parse", findings[0])

    def test_application_yaml_tags_are_read(self) -> None:
        text = "services:\n  a:\n    arguments: [!tagged_iterator x]\n"
        self.assertEqual(guard.scan("Services.yaml", text), (0, 0, []))


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

    def test_branded_docs_badge_is_read(self) -> None:
        path = "outputStyles/branded-docs.md"
        text = (ROOT / path).read_text(encoding="utf-8")
        self.assertIn("#2F99A4", list(guard.colours_in(".md", text)))
        self.assertEqual(guard.findings_in(path, text)[1], [])

    def test_deliberate_quotes_are_not_read(self) -> None:
        for path in (
            "evals/evals.json",
            "site/index.html",
            "site/favicon.svg",
            ".github/workflows/brand-colours.yml",
        ):
            with self.subTest(path):
                text = (ROOT / path).read_text(encoding="utf-8")
                self.assertEqual(guard.findings_in(path, text)[1], [])


def _delta_e(a: str, b: str) -> float:
    return guard.Color(a).delta_e(b, method="2000")


if __name__ == "__main__":
    unittest.main()
