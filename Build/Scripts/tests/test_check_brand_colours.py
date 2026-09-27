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
import contextlib
import importlib.util
import io
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.parse

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
# Unpadded base64 of lengths 2 and 3 modulo 4, for the srcset comma cases.
UNPADDED_2 = (
    base64.b64encode(b'<svg><path fill="#2999a4" /></svg>').decode().rstrip("=")
)
UNPADDED_3 = (
    base64.b64encode(b'<svg><path fill="#2999a4"  /></svg>').decode().rstrip("=")
)
assert len(UNPADDED_2) % 4 == 2
assert len(UNPADDED_3) % 4 == 3
PCT_B64 = urllib.parse.quote(LOGO_B64, safe="")
assert "%2B" in PCT_B64
assert "%3D" in PCT_B64
LATIN1_B64 = base64.b64encode(
    '<svg><!-- \u00e9 --><path fill="#2999a4"/></svg>'.encode("latin-1")
).decode()
UTF16_B64 = base64.b64encode(
    '<svg><path fill="#2999a4"/></svg>'.encode("utf-16")
).decode()
DATA_SVG = "data:image/svg+xml;base64,"
# An SVG whose fill comes from an internal DTD entity.
ENTITY_SVG = (
    '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY c "#2999a4">]>'
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="&c;"/></svg>'
)
ENTITY_B64 = base64.b64encode(ENTITY_SVG.encode()).decode()
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
    "shields ?color=%23 upper-case hex (renders #2999a4)": (
        "d0.md",
        "![b](https://img.shields.io/badge/a-b-blue?color=%232999A4)\n",
    ),
    # Round 8: a malformed svg fence falls back to html.parser.
    "md fenced svg that is not well-formed": (
        "da.md",
        '```svg\n<svg><path fill="#2999a4"><g></svg>\n```\n',
    ),
    # an ATTLIST default attribute, which both browsers paint
    "svg ATTLIST default fill": (
        "db.svg",
        (
            '<!DOCTYPE svg [<!ATTLIST rect fill CDATA "#2999a4">]>'
            '<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40"/></svg>'
        ),
    ),
    "md fenced html that is not XML": (
        "d9.md",
        '```html\n<p style="color:#2999a4">x<br></p>\n```\n',
    ),
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
    # Round 5: srcset parsed with the HTML algorithm, data: URLs with the
    # Fetch Standard's processor.
    "srcset unpadded base64 (len%4==2) then a comma": (
        "h1.html",
        f'<img srcset="{DATA_SVG}{UNPADDED_2}, b.png 2x" alt="">',
    ),
    "srcset unpadded base64 (len%4==3) then a comma": (
        "h2.html",
        f'<img srcset="{DATA_SVG}{UNPADDED_3}, b.png 2x" alt="">',
    ),
    "srcset descriptor then a comma without a space": (
        "h3.html",
        f'<img srcset="a.png 1x,{DATA_SVG}{PLAIN_B64} 2x" alt="">',
    ),
    "srcset two trailing commas": (
        "h4.html",
        f'<img srcset="{DATA_SVG}{UNPADDED_2},, b.png 2x" alt="">',
    ),
    "imagesrcset on a preload link": (
        "h5.html",
        f'<link rel="preload" as="image" imagesrcset="{DATA_SVG}{PLAIN_B64} 1x">',
    ),
    "data-srcset for a lazy loader": (
        "h6.html",
        f'<img data-srcset="a.png 1x, {DATA_SVG}{PLAIN_B64} 2x" alt="">',
    ),
    "data: header '; base64'": (
        "h7.html",
        f'<img src="data:image/svg+xml; base64,{PLAIN_B64}" alt="">',
    ),
    "data: header 'data: image/svg+xml'": (
        "h8.html",
        f'<img src="data: image/svg+xml;base64,{PLAIN_B64}" alt="">',
    ),
    "data: header ';base64 ,'": (
        "h9.html",
        f'<img src="data:image/svg+xml;base64 ,{PLAIN_B64}" alt="">',
    ),
    "uppercase DATA: and BASE64 in an attribute": (
        "i1.html",
        f'<img src="DATA:IMAGE/SVG+XML;BASE64,{PLAIN_B64}" alt="">',
    ),
    "percent-encoded base64 body in an attribute": (
        "i2.html",
        f'<img src="{DATA_SVG}{PCT_B64}" alt="">',
    ),
    "percent-encoded base64 body in css url()": (
        "i3.css",
        f'.x{{background:url("{DATA_SVG}{PCT_B64}")}}',
    ),
    "base64 SVG in Latin-1 with a non-ASCII byte": (
        "i4.html",
        f'<img src="{DATA_SVG}{LATIN1_B64}" alt="">',
    ),
    # Round 6.
    "data: header ';ba\u017fe64' is not base64 (plain body)": (
        "j1.html",
        '<img src="data:image/svg+xml;ba\u017fe64,%3Csvg%3E%3Cpath fill=%22%232999a4%22/%3E%3C/svg%3E" alt="">',
    ),
    "svg internal DTD entity": ("j2.svg", ENTITY_SVG),
    "data: SVG with an internal DTD entity": (
        "j3.html",
        f'<img src="{DATA_SVG}{ENTITY_B64}" alt="">',
    ),
    "svg nested DTD entities": (
        "j4.svg",
        (
            '<!DOCTYPE svg [<!ENTITY a "#2999"><!ENTITY c "&a;a4">]>'
            '<svg xmlns="http://www.w3.org/2000/svg"><path fill="&c;"/></svg>'
        ),
    ),
    "svg DTD entity in <style>": (
        "j5.svg",
        (
            '<!DOCTYPE svg [<!ENTITY c "#2999a4">]>'
            '<svg xmlns="http://www.w3.org/2000/svg"><style>.x{fill:&c;}</style></svg>'
        ),
    ),
    "srcset candidate after a parenthesised descriptor": (
        "j6.html",
        f'<img srcset="x.png (a), {DATA_SVG}{PLAIN_B64} 1x" alt="">',
    ),
    "tab and newline inside the URL are removed": (
        "i5.html",
        f'<img src="{DATA_SVG}{PLAIN_B64[:8]}\t{PLAIN_B64[8:16]}\n{PLAIN_B64[16:]}" alt="">',
    ),
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
    # shields renders its default #4b0 for a whitespace-prefixed bare hex
    # (measured on img.shields.io in review round 7)
    "shields path %C2%A0 before bare hex": (
        "q1.md",
        "![b](https://img.shields.io/badge/a-b-%C2%A02999a4)\n",
    ),
    "shields path %20 before bare hex": (
        "q2.md",
        "![b](https://img.shields.io/badge/a-b-%202999a4)\n",
    ),
    "shields ?color=%C2%A0 before #hex": (
        "q3.md",
        "![b](https://img.shields.io/badge/a-b-blue?color=%C2%A0%232999a4)\n",
    ),
    # a no-break space before a logo's data: URL stays in the URL (the URL
    # parser strips only C0 controls and spaces): derived, not measured
    "shields ?logo= with %C2%A0 before data:": (
        "q5.md",
        "![b](https://img.shields.io/badge/a-b-blue?logo=%C2%A0data:image/svg%2bxml;base64,"
        + LOGO_B64.replace("+", "%2B")
        + ")\n",
    ),
    # ".svg" followed by a newline is no extension: the colour is "#2999a4.svg\n"
    "shields path .svg then %0A": (
        "q4.md",
        "![b](https://img.shields.io/badge/a-b-%232999a4.svg%0A)\n",
    ),
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
    # A raw # starts the URL's fragment, which the data: URL processor
    # excludes: the SVG ends at fill=" and never carries the colour.
    "raw # in a plain data: SVG ends the body": (
        "z1.css",
        ".x{background:url('data:image/svg+xml;utf8,<svg><path fill=\"#2999a4\"/></svg>')}",
    ),
    "srcset candidate with an invalid descriptor is dropped": (
        "z2.html",
        f'<img srcset="{DATA_SVG}{PLAIN_B64} 1x 2x" alt="">',
    ),
    "srcset candidate with both w and x is dropped": (
        "z3.html",
        f'<img srcset="{DATA_SVG}{PLAIN_B64} 100w 1x" alt="">',
    ),
    "data:text/plain carrying SVG text": (
        "z4.html",
        '<img src="data:text/plain,%3Csvg%3E%3Cpath fill=%22%232999a4%22/%3E%3C/svg%3E" alt="">',
    ),
    "base64 body with a length of 1 modulo 4 fails": (
        "z5.html",
        f'<img src="{DATA_SVG}{UNPADDED_2}AAA" alt="">',
    ),
    "md html fence with a DTD entity (read as HTML, not expanded)": (
        "k0.md",
        '```html\n<!DOCTYPE html [<!ENTITY c "#2999a4">]><p style="color:&c;">x</p>\n```\n',
    ),
    "DTD entity in HTML (browsers expand none there)": (
        "k1.html",
        '<!DOCTYPE html [<!ENTITY c "#2999a4">]><p style="color:&c;">x</p>',
    ),
    "no-break space before data: is not stripped (the URL is relative)": (
        "k2.html",
        f'<img src="&nbsp;{DATA_SVG}{PLAIN_B64}" alt="">',
    ),
    "animate attributeName with a Kelvin sign is not stroke": (
        "k3.svg",
        SVG.format(
            '<rect><animate attributeName="stro\u212ae" values="#2999a4"/></rect>'
        ),
    ),
    "UTF-16 SVG (not covered: decoded as UTF-8)": (
        "z6.html",
        f'<img src="{DATA_SVG}{UTF16_B64}" alt="">',
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


class SpecAlgorithms(unittest.TestCase):
    """One assertion per step of the three WHATWG algorithms the guard follows."""

    def test_forgiving_base64_decode(self) -> None:
        decode = guard.forgiving_base64_decode
        self.assertEqual(decode(" Y W J j "), b"abc")  # 1. whitespace removed
        self.assertEqual(decode("YQ=="), b"a")  # 2. "==" removed
        self.assertEqual(decode("YWI="), b"ab")  # 2. "=" removed
        self.assertEqual(decode("YQ"), b"a")  # padding optional
        self.assertIsNone(decode("YWJjZ"))  # 3. length 1 modulo 4
        self.assertIsNone(decode("YQ=\x3d="))  # 3. three "=" leave a remainder of 1
        self.assertIsNone(decode("YW,J"))  # 4. a code point outside the alphabet
        self.assertIsNone(decode("Y=Q="))  # 4. "=" inside the data

    def test_mime_type_essence(self) -> None:
        essence = guard.mime_type_essence
        self.assertEqual(essence(" Image/SVG+XML ;charset=utf-8"), "image/svg+xml")
        self.assertEqual(essence("image/svg+xml \t;x=y"), "image/svg+xml")
        self.assertEqual(essence("image"), "text/plain")  # no "/"
        self.assertEqual(essence("/svg"), "text/plain")  # empty type
        self.assertEqual(essence("image/"), "text/plain")  # empty subtype
        self.assertEqual(essence("im age/svg"), "text/plain")  # not a token

    def test_data_url_processor(self) -> None:
        parse = guard.parse_data_url
        self.assertEqual(parse("  data:,a  "), ("text/plain", b"a"))  # URL parser strip
        self.assertEqual(parse("data:,a\tb\nc"), ("text/plain", b"abc"))  # tab/newline
        self.assertIsNone(parse("date:,a"))  # 1. scheme
        self.assertEqual(parse("data:,a#b"), ("text/plain", b"a"))  # 2. fragment
        self.assertIsNone(parse("data:image/svg+xml"))  # 7. no comma
        self.assertEqual(parse("data:,%41%2c"), ("text/plain", b"A,"))  # 10.
        self.assertEqual(
            parse("data:image/png ;  BASE64,YQ"), ("image/png", b"a")
        )  # 11.
        self.assertIsNone(parse("data:;base64,YWJjZ"))  # 11.3
        self.assertEqual(parse("data:;charset=x,a")[0], "text/plain")  # 12.
        self.assertEqual(parse("data:bogus,a")[0], "text/plain")  # 14.

    def test_srcset_parser(self) -> None:
        urls = guard.srcset_urls
        self.assertEqual(urls(" a.png 1x , b.png 2x "), ["a.png", "b.png"])
        self.assertEqual(urls("a.png,b.png"), ["a.png,b.png"])  # no split on ","
        self.assertEqual(urls("a.png, b.png"), ["a.png", "b.png"])
        self.assertEqual(urls("a.png,, b.png"), ["a.png", "b.png"])
        self.assertEqual(urls("a.png 1x,b.png 2x"), ["a.png", "b.png"])
        self.assertEqual(urls(",,a.png"), ["a.png"])
        self.assertEqual(urls("a.png 100w 50h"), ["a.png"])
        self.assertEqual(urls("a.png f(x, y) 1x"), [])  # parens keep the comma
        self.assertEqual(urls("a.png 50h"), [])  # h without w
        self.assertEqual(urls("a.png 0w"), [])
        self.assertEqual(urls("a.png 1x 1x"), [])
        self.assertEqual(urls("a.png 100w 1x"), [])
        self.assertEqual(urls("a.png 1x 100w"), [])  # w after x
        self.assertEqual(urls("a.png 2q"), [])  # unknown descriptor
        self.assertEqual(urls("a.png 1.5"), [])  # no descriptor letter
        self.assertEqual(urls("a.png 1.5x, b.png -1x"), ["a.png"])
        self.assertEqual(urls("a.png \u0662x"), [])  # Arabic-Indic digit: not ASCII
        self.assertEqual(urls("a.png \u0661\u0660w"), [])
        self.assertEqual(urls("a.png (a), b.png 1x"), ["b.png"])  # ")" leaves parens

    def test_ascii_lower(self) -> None:
        self.assertEqual(guard.ascii_lower("DATA:Image"), "data:image")
        # U+212A KELVIN SIGN and U+0130 stay; str.lower() would change both
        self.assertEqual(guard.ascii_lower("\u212a\u0130"), "\u212a\u0130")

    def test_shields_names_are_case_sensitive(self) -> None:
        self.assertEqual(guard._badge_colour("orange"), "#ea7233")
        self.assertEqual(guard._badge_colour("orangered"), "orangered")  # CSS name
        # shields renders its default #4b0 for a capitalised name: no colour
        for name in ("Orange", "CadetBlue", "OrangeRed", "ORANGE"):
            with self.subTest(name):
                self.assertIsNone(guard._badge_colour(name))
        self.assertEqual(guard._badge_colour("2999A4"), "#2999A4")  # hex stays


def _chain(levels: int, fanout: int = 1, leaf: str = "#2999a4") -> str:
    """A DOCTYPE whose entity l<levels> expands through LEVELS levels."""
    declarations = [f'<!ENTITY l0 "{leaf}">'] + [
        f'<!ENTITY l{i} "' + f"&l{i - 1};" * fanout + '">' for i in range(1, levels + 1)
    ]
    return "<!DOCTYPE svg [" + "".join(declarations) + "]>"


NS = 'xmlns="http://www.w3.org/2000/svg" width="40" height="40"'
RECT = '<rect width="40" height="40" fill="{}"/>'
# The reviewer's round-7 cases, rendered in Chrome 154 and Firefox 155:
# True where at least one browser paints #2999a4, False where neither does.
BROWSER_SVG_CASES = {
    "control: plain fill": (f"<svg {NS}>{RECT.format('#2999a4')}</svg>", True),
    "control: entity fill": (
        f'<!DOCTYPE svg [<!ENTITY c "#2999a4">]><svg {NS}>{RECT.format("&c;")}</svg>',
        True,
    ),
    "nesting 7 deep": (_chain(7) + f"<svg {NS}>{RECT.format('&l7;')}</svg>", True),
    "nesting 8 deep": (_chain(8) + f"<svg {NS}>{RECT.format('&l8;')}</svg>", True),
    "nesting 12 deep": (_chain(12) + f"<svg {NS}>{RECT.format('&l12;')}</svg>", True),
    "billion laughs 4x10 (10^4 copies)": (
        _chain(4, 10, "") + f"<svg {NS}>{RECT.format('#2999a4&l4;')}</svg>",
        True,
    ),
    "param entity declares general (Firefox)": (
        (
            f"<!DOCTYPE svg [<!ENTITY % p \"<!ENTITY c '#2999a4'>\"> %p;]>"
            f"<svg {NS}>{RECT.format('&c;')}</svg>"
        ),
        True,
    ),
    "entity with markup in content": (
        f"<!DOCTYPE svg [<!ENTITY e '{RECT.format('#2999a4')}'>]><svg {NS}>&e;</svg>",
        True,
    ),
    "entity named nbsp": (
        f'<!DOCTYPE svg [<!ENTITY nbsp "#2999a4">]><svg {NS}>{RECT.format("&nbsp;")}</svg>',
        True,
    ),
    "entity named not": (
        f'<!DOCTYPE svg [<!ENTITY not "#2999a4">]><svg {NS}>{RECT.format("&not;")}</svg>',
        True,
    ),
    "non-ASCII entity name": (
        f'<!DOCTYPE svg [<!ENTITY \u00e9 "#2999a4">]><svg {NS}>{RECT.format("&\u00e9;")}</svg>',
        True,
    ),
    "standalone=no external PE, then decl (Chrome)": (
        (
            '<?xml version="1.0" standalone="no"?><!DOCTYPE svg [<!ENTITY % ext SYSTEM '
            f'"nothere.dtd"> %ext; <!ENTITY c "#2999a4">]><svg {NS}>{RECT.format("&c;")}</svg>'
        ),
        True,
    ),
    "charref &#38;c; in an attribute is the literal &c;": (
        f'<!DOCTYPE svg [<!ENTITY c "#2999a4">]><svg {NS}>{RECT.format("&#38;c;")}</svg>',
        False,
    ),
    "entity in <style>": (
        (
            f'<!DOCTYPE svg [<!ENTITY c "#2999a4">]><svg {NS}><style>rect{{fill:&c;}}</style>'
            '<rect width="40" height="40"/></svg>'
        ),
        True,
    ),
    "duplicate declaration: the first wins": (
        f'<!DOCTYPE svg [<!ENTITY c "#ffffff"><!ENTITY c "#2999a4">]><svg {NS}>{RECT.format("&c;")}</svg>',
        False,
    ),
    "CDATA <style> keeps &c; literal": (
        (
            f'<!DOCTYPE svg [<!ENTITY c "#2999a4">]><svg {NS}><style><![CDATA[rect{{fill:&c;}}]]>'
            '</style><rect width="40" height="40"/></svg>'
        ),
        False,
    ),
    "internal empty PE reference, then decl": (
        f'<!DOCTYPE svg [<!ENTITY % x ""> %x; <!ENTITY c "#2999a4">]><svg {NS}>{RECT.format("&c;")}</svg>',
        True,
    ),
    "same, standalone=yes (Firefox)": (
        (
            '<?xml version="1.0" standalone="yes"?><!DOCTYPE svg [<!ENTITY % x ""> %x; '
            f'<!ENTITY c "#2999a4">]><svg {NS}>{RECT.format("&c;")}</svg>'
        ),
        True,
    ),
    "entity in a comment inside <style>": (
        (
            f'<!DOCTYPE svg [<!ENTITY c "#2999a4">]><svg {NS}><style>/* &c; */</style>'
            '<rect width="40" height="40" fill="#fff"/></svg>'
        ),
        False,
    ),
}
# Not well-formed, or over libexpat's amplification limit: browsers paint
# nothing, the guard reads nothing, and an .svg file is reported unparseable.
BROWSER_BROKEN_SVG_CASES = {
    "billion laughs 10x10": _chain(10, 10) + f"<svg {NS}>{RECT.format('&l10;')}</svg>",
    "undefined entity after use": (
        f'<!DOCTYPE svg [<!ENTITY c "#2999a4">]><svg {NS}>{RECT.format("&c;")}<g fill="&u;"/></svg>'
    ),
    # 1 MB of input expanding to 2 GB: a = 333,333 x &b;, b = 6,000 characters
    "1 MB amplification": (
        '<!DOCTYPE svg [<!ENTITY b "'
        + "#2999a4 " * 750
        + '"><!ENTITY a "'
        + "&b;" * 333_333
        + f'">]><svg {NS}>{RECT.format("&a;")}</svg>'
    ),
}


class SvgEntities(unittest.TestCase):
    """SVG read by expat, against what Chrome 154 and Firefox 155 render."""

    def test_as_svg_file_and_as_data_url(self) -> None:
        for name, (svg, rendered) in BROWSER_SVG_CASES.items():
            data_url = f'<img src="{DATA_SVG}{base64.b64encode(svg.encode()).decode()}" alt="">'
            for path, text in (("a.svg", svg), ("a.html", data_url)):
                with self.subTest(name, path=path):
                    self.assertEqual(bool(guard.findings_in(path, text)[1]), rendered)

    def test_broken_svg_is_unparseable_and_reads_nothing(self) -> None:
        for name, svg in BROWSER_BROKEN_SVG_CASES.items():
            data_url = f'<img src="{DATA_SVG}{base64.b64encode(svg.encode()).decode()}" alt="">'
            with self.subTest(name, path="a.svg"):
                read, _, findings = guard.scan("a.svg", svg)
                self.assertEqual(read, 0)
                self.assertEqual(len(findings), 1)
                self.assertIn("does not parse", findings[0])
            with self.subTest(name, path="a.html"):
                self.assertEqual(guard.scan("a.html", data_url), (0, 0, []))

    def test_amplification_stops_early(self) -> None:
        # libexpat's limit, not Python: both cases stop well under a second
        for name in ("billion laughs 10x10", "1 MB amplification"):
            with self.subTest(name):
                start = time.perf_counter()
                with self.assertRaises(guard.NotWellFormed):
                    guard.svg_colours(BROWSER_BROKEN_SVG_CASES[name])
                self.assertLess(time.perf_counter() - start, 5)

    def test_external_entities_are_empty(self) -> None:
        svg = (
            '<!DOCTYPE svg SYSTEM "http://127.0.0.1:9/x.dtd" [<!ENTITY % ext SYSTEM '
            '"/etc/hostname"> %ext; <!ENTITY c SYSTEM "file:///etc/passwd">]>'
            f"<svg {NS}><g>&c;</g>{RECT.format('#2999a4')}</svg>"
        )
        # an external entity in content is parsed as empty: nothing opened
        self.assertEqual(guard.svg_colours(svg), ["#2999a4"])
        # in an attribute value it is not well-formed XML
        in_attribute = svg.replace("<g>&c;</g>", '<g fill="&c;"/>')
        with self.assertRaises(guard.NotWellFormed):
            guard.svg_colours(in_attribute)

    def test_refuses_without_amplification_protection(self) -> None:
        saved = guard.EXPAT_PROTECTED
        guard.EXPAT_PROTECTED = False
        try:
            with self.assertRaises(RuntimeError):
                guard.svg_colours(f"<svg {NS}/>")
        finally:
            guard.EXPAT_PROTECTED = saved


class RepeatedValues(unittest.TestCase):
    """A value repeated by entity expansion (under libexpat's 8 MiB
    threshold) costs one comparison and yields one finding."""

    SMALL = (
        '<!DOCTYPE svg [<!ENTITY b "'
        + "#2999a4 " * 1000
        + '"><!ENTITY a "'
        + "&b;" * 250
        + '">]>'
        '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="&a;"/></svg>'
    )

    def test_one_finding_per_distinct_value(self) -> None:
        read, _, findings = guard.scan(
            "a.css", ".a{color:#2999a4}.b{color:#2999a4}.c{color:#595a62}"
        )
        self.assertEqual(read, 3)
        self.assertEqual(len(findings), 2)
        self.assertIn("#2999a4 is a near miss", findings[0])
        self.assertIn("2 occurrences", findings[0])
        self.assertNotIn("occurrences", findings[1])

    def test_near_miss_is_memoised(self) -> None:
        guard.near_miss.cache_clear()
        guard.scan("a.css", ".a{color:#2999a4}")
        guard.scan("b.css", ".b{color:#2999a4}")
        self.assertEqual(guard.near_miss.cache_info().hits, 1)

    def test_8_9_kb_expanding_to_2_mb(self) -> None:
        start = time.perf_counter()
        read, _, findings = guard.scan("a.svg", self.SMALL)
        self.assertEqual(read, 250_000)
        self.assertEqual(len(findings), 1)
        self.assertIn("250000 occurrences", findings[0])
        self.assertLess(time.perf_counter() - start, 5)  # 9.8 s before the memo


class TrackedFiles(unittest.TestCase):
    def test_paths_with_spaces_and_non_ascii(self) -> None:
        name = "a b " + chr(0xE9) + ".css"  # git quotes it without -z
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / name).write_text(".x{color:#2999a4}", encoding="utf-8")
            (root / "plain.css").write_text(".x{color:#2F99A4}", encoding="utf-8")
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            previous = pathlib.Path.cwd()
            os.chdir(root)
            try:
                self.assertEqual(
                    sorted(guard.tracked_files()), sorted([name, "plain.css"])
                )
                with contextlib.redirect_stdout(io.StringIO()) as output:
                    status = guard.main()
            finally:
                os.chdir(previous)
        self.assertEqual(status, 1)
        self.assertIn(name + ": #2999a4 is a near miss", output.getvalue())


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
