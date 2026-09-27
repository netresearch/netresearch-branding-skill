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
"""Fail when a tracked file uses a near miss of a brand colour.

references/logo.md states that #2F99A4 (frame) and #585961 (letter) are the
only valid colour values for the symbol, and that a close approximation is
brand debt. The canonical symbol shipped #2999a4 and #595a62 for a long time
without anything noticing, so this check looks for exactly that class: a
colour close to a brand colour (#2F99A4, #585961, #FF4D00) but not equal to it.

Metric. A colour is a near miss when its sRGB value differs from a brand
colour and either every channel is within NEAR_MISS (8) of it, or its
CIEDE2000 distance is below DELTA_E (2.0). The two defects the check was
written for sit at channel distance 6 and 1 (dE00 0.38 and 0.36). The channel
test alone misses near-identical colours such as #FF4D09 (distance 9, dE00
0.68). The nearest documented intentional variant, #4D4F57 in
references/colors.md, sits at distance 11 and dE00 3.62, and passes. Alpha is
ignored: #2F99A4 at any opacity is the brand colour.

Notations covered, all read by a parser rather than by a pattern:
  - hex #rgb, #rgba, #rrggbb, #rrggbbaa
  - rgb(), rgba(), hsl(), hsla(), hwb(), lab(), lch(), oklab(), oklch(),
    color(), in comma and space syntax
  - a bare channel triple in a custom property whose name ends in -rgb,
    e.g. `--nr-primary-rgb: 41, 153, 164`
Not covered: named colours (`teal`), colours computed at runtime
(color-mix(), var() chains, relative colour syntax, Sass functions such as
darken()), and colours inside raster images.

Where colours are read:
  - *.css, *.scss: every token of the file (tinycss2); comments are skipped.
    An ID selector that happens to be a valid hex colour near a brand colour
    would be reported; the repository has none.
  - *.svg, *.html: <style> elements, `style=` attributes and the colour
    presentation attributes (fill, stroke, stop-color, flood-color,
    lighting-color, color, bgcolor), via html.parser. Comments and <script>
    are not read.
  - *.md: fenced code blocks tagged css, scss, svg, html or xml
    (markdown-it-py), read as the matching file type above.
  - *.json, *.yaml, *.yml: string values whose whole content is a single
    colour, e.g. `primary: "#2999a4"`. A colour mentioned inside a longer
    string is prose, not configuration, and is not read.

Deliberate quotes of the old values, and why none of them is reported:
  - evals/evals.json:182 quotes #2e98a3 / #ff4e01 inside an eval prompt: a
    colour inside a longer JSON string is not read.
  - site/index.html:1079-1080 (finding F3) quotes #2999a4 / #595a62 inside a
    <script> block, which is not read.
  - site/favicon.svg:4-5 quotes them in an XML comment, which is not read.
  - this script quotes them in a Python docstring; *.py is not scanned.
There is therefore no exclusion list. A new deliberate quote in a place that
IS read needs one, with its path and reason, rather than a weaker metric.

Usage: check-brand-colours.py   (run from the repository root; takes no
arguments and scans every tracked file of the types above)
"""

from __future__ import annotations

import json
import subprocess
import sys
from collections.abc import Iterator
from html.parser import HTMLParser

import tinycss2
import yaml
from coloraide import Color
from markdown_it import MarkdownIt

BRAND = {
    "#2F99A4": "primary turquoise",
    "#585961": "text anthracite",
    "#FF4D00": "accent orange",
}
NEAR_MISS = 8
DELTA_E = 2.0
PATTERNS = ["*.css", "*.scss", "*.svg", "*.html", "*.md", "*.json", "*.yaml", "*.yml"]
COLOUR_FUNCTIONS = {
    "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color",
}  # fmt: skip
COLOUR_ATTRIBUTES = {
    "fill", "stroke", "stop-color", "flood-color", "lighting-color", "color", "bgcolor",
}  # fmt: skip
FENCE_LANGUAGES = {
    "css": ".css",
    "scss": ".css",
    "svg": ".svg",
    "html": ".svg",
    "xml": ".svg",
}


def to_rgb(text: str) -> tuple[int, int, int] | None:
    """sRGB 0-255 channels of a CSS colour string, or None if it is not one."""
    try:
        colour = Color(text).convert("srgb").fit()
    except ValueError:
        return None
    return tuple(round(c * 255) for c in colour.coords())  # type: ignore[return-value]


def css_colours(text: str) -> Iterator[str]:
    """Every colour value written in a piece of CSS or SCSS."""
    yield from _walk(tinycss2.parse_component_value_list(text, skip_comments=True))


def _walk(tokens: list) -> Iterator[str]:
    meaningful = [t for t in tokens if t.type not in ("whitespace", "comment")]
    for index, token in enumerate(meaningful):
        if token.type == "hash":
            yield "#" + token.value
        elif token.type == "function" and token.lower_name in COLOUR_FUNCTIONS:
            yield token.serialize()
        elif (
            token.type == "ident"
            and token.value.startswith("--")
            and token.value.endswith("-rgb")
        ):
            triple = _channel_triple(meaningful[index + 1 :])
            if triple:
                yield triple
        if token.type in ("() block", "[] block", "{} block") or (
            token.type == "function" and token.lower_name not in COLOUR_FUNCTIONS
        ):
            yield from _walk(
                token.content if hasattr(token, "content") else token.arguments
            )


def _channel_triple(rest: list) -> str | None:
    """`: 41, 153, 164` after a --*-rgb property name, as `rgb(41,153,164)`."""
    if not rest or rest[0].type != "literal" or rest[0].value != ":":
        return None
    numbers = []
    for token in rest[1:]:
        if token.type == "literal" and token.value == ",":
            continue
        if token.type == "number" and token.is_integer and 0 <= token.int_value <= 255:
            numbers.append(token.int_value)
            continue
        break
    if len(numbers) != 3:
        return None
    return "rgb({},{},{})".format(*numbers)


class _MarkupColours(HTMLParser):
    """Colours in <style>, style= and colour presentation attributes."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.found: list[str] = []
        self._in_style = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "style":
            self._in_style = True
        for name, value in attrs:
            if value and (name == "style" or name in COLOUR_ATTRIBUTES):
                self.found.extend(css_colours(value))

    def handle_endtag(self, tag: str) -> None:
        if tag == "style":
            self._in_style = False

    def handle_data(self, data: str) -> None:
        if self._in_style:
            self.found.extend(css_colours(data))


def markup_colours(text: str) -> list[str]:
    parser = _MarkupColours()
    parser.feed(text)
    parser.close()
    return parser.found


def markdown_colours(text: str) -> Iterator[str]:
    for token in MarkdownIt().parse(text):
        if token.type != "fence":
            continue
        language = (token.info.split() or [""])[0].lower()
        kind = FENCE_LANGUAGES.get(language)
        if kind:
            yield from colours_in(kind, token.content)


def _strings(node: object) -> Iterator[str]:
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for key, value in node.items():
            yield from _strings(key)
            yield from _strings(value)
    elif isinstance(node, list):
        for item in node:
            yield from _strings(item)


def data_colours(documents: list) -> Iterator[str]:
    """Strings whose whole content is one colour value."""
    for text in _strings(documents):
        values = list(css_colours(text))
        tokens = [
            t
            for t in tinycss2.parse_component_value_list(text, skip_comments=True)
            if t.type != "whitespace"
        ]
        if len(values) == 1 and len(tokens) == 1:
            yield values[0]


def colours_in(kind: str, text: str) -> Iterator[str]:
    if kind in (".css", ".scss"):
        yield from css_colours(text)
    elif kind in (".svg", ".html"):
        yield from markup_colours(text)
    elif kind == ".md":
        yield from markdown_colours(text)
    elif kind == ".json":
        yield from data_colours([json.loads(text)])
    elif kind in (".yaml", ".yml"):
        yield from data_colours(list(yaml.safe_load_all(text)))


def near_miss(value: str) -> tuple[str, int, float] | None:
    """(brand colour, channel distance, dE00) when VALUE nearly matches one."""
    rgb = to_rgb(value)
    if rgb is None:
        return None
    for brand in BRAND:
        brand_rgb = to_rgb(brand)
        assert brand_rgb is not None
        if rgb == brand_rgb:
            return None
    for brand in BRAND:
        brand_rgb = to_rgb(brand)
        assert brand_rgb is not None
        distance = max(abs(a - b) for a, b in zip(rgb, brand_rgb))
        delta_e = Color("srgb", [c / 255 for c in rgb]).delta_e(brand, method="2000")
        if distance <= NEAR_MISS or delta_e < DELTA_E:
            return brand, distance, delta_e
    return None


def findings_in(path: str, text: str) -> tuple[int, list[str]]:
    """(number of colour values read, near-miss messages) for one file."""
    kind = "." + path.rsplit(".", 1)[-1].lower()
    values = list(colours_in(kind, text))
    messages = []
    for value in values:
        match = near_miss(value)
        if match:
            brand, distance, delta_e = match
            messages.append(
                f"{path}: {value} is a near miss of {brand} ({BRAND[brand]}; "
                f"channel distance {distance}, dE00 {delta_e:.2f}); use {brand}"
            )
    return len(values), messages


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", *PATTERNS], capture_output=True, text=True, check=True
    )
    return result.stdout.split()


def main() -> int:
    files = tracked_files()
    if not files:
        print("check-brand-colours: no files found", file=sys.stderr)
        return 2
    findings: list[str] = []
    read = 0
    for path in files:
        with open(path, encoding="utf-8") as handle:
            count, messages = findings_in(path, handle.read())
        read += count
        findings.extend(messages)
    for message in findings:
        print(message)
    print(
        f"check-brand-colours: {len(files)} files, {read} colour values, "
        f"{len(findings)} finding(s)"
    )
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
