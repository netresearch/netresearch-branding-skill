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
    color(), in comma and space syntax, ASCII case-insensitive (tinycss2's
    lower_name)
  - literal colour arguments of any other function: color-mix(in srgb,
    #2999a4, white), Sass darken(#2999a4, 5%), relative colour syntax
    rgb(from #2999a4 r g b), and a colour function coloraide cannot parse,
    such as SCSS rgba(#2999a4, .5). Those unparsed functions are counted in
    the summary line.
  - a bare channel triple, comma or space separated, in a CSS custom property
    or a Sass variable whose name ends in -rgb: `--nr-primary-rgb: 41, 153,
    164`, `$nr-primary-rgb: 41 153 164`
  - legacy HTML colour attributes (bgcolor on any element; text, link,
    vlink, alink on <body>), as hex with or without the leading #, or as a
    CSS colour name
  - the colours of an img.shields.io badge URL: the last path segment of
    /badge/label-message-COLOUR and the color, labelColor, logoColor, colorA
    and colorB query values, URL-decoded, as bare hex, #hex, a CSS colour
    function, a lower-case CSS colour name, or one of shields' own names
    (brightgreen, blue, ... and their aliases, mapped to shields' values,
    none of which is near a brand colour). A letters-only value with an
    upper-case letter (Orange, CadetBlue) is no colour: shields renders its
    default for it. The badge in outputStyles/branded-docs.md is one.
  - an SVG logo in a shields.io logo= query value (shields embeds it
    verbatim; the data: prefix is optional there)
  - SVG carried by a data: URL whose MIME type is image/svg+xml, decoded
    by the Fetch Standard's data: URL processor (parse_data_url below): the
    header may carry spaces ("data: image/svg+xml; base64 ,") and is matched
    ASCII case-insensitively ("DATA:", "BASE64"; ";ba\u017fe64" is not base64),
    the body is percent-decoded and then, for base64, forgiving-base64
    decoded (whitespace dropped, padding optional). A raw # ends the body,
    because the processor excludes the URL's fragment. The SVG is decoded
    as UTF-8 with replacement characters. Read in CSS url(), and in every
    attribute of every HTML and SVG element under any namespace prefix (src,
    data, poster, background, x:href, ...); an attribute whose name ends in
    srcset (srcset, imagesrcset, data-srcset) is split into its image
    candidates by the HTML Standard's srcset parser, which also drops a
    candidate with invalid descriptors. Also inside Markdown inline HTML and
    HTML blocks. A Markdown image or link with a data:image/svg+xml URL is
    not read: markdown-it's validateLink rejects it, so markdown-it renders
    it as text, and GitHub renders it as an empty <img>.

Not covered, each measured as a bypass in review:
  - CSS colour names (`teal`) everywhere except the legacy HTML attributes
    and shields.io badges above, and colours computed at runtime: the result
    of color-mix(), of var() chains, of Sass functions and of relative colour
    syntax. Their literal arguments are read (see above); the colour they
    produce is not, and neither is a colour function whose channels come
    from var(), e.g. rgb(var(--r, 41) 153 164).
  - CSS string contents other than data: URLs inside url(), e.g.
    content: "#2999a4" or a data: URL given as a plain string to image-set()
  - Markdown HTML that markdown-it splits across blocks, e.g. a <style>
    element with a blank line inside a <div>, or <style> inline in a paragraph
  - Markdown outside fences except inline HTML, HTML blocks and badge URLs:
    colours in prose, in other URLs and in link text are not read
  - JSON and YAML strings that contain more than one colour value, such as
    "1px solid #2999a4" or "linear-gradient(...)", and hex without # in
    them; see "Where colours are read"
  - fenced blocks in any language other than those listed below
  - non-standard colour attributes such as bordercolor
  - an SVG in a data: URL encoded in UTF-16 (decoded as UTF-8, it yields no
    markup)
  - colours inside raster images

Where colours are read:
  - *.css, *.scss: colour values in declarations, custom properties and
    Sass variables (tinycss2 tokens, walked recursively into blocks and
    function arguments); comments and strings are skipped. An ID selector
    that happens to be a valid hex colour near a brand colour would be
    reported; the repository has none.
  - *.svg, and an SVG from a data: URL: read by expat as XML (svg_colours).
    expat expands the internal DTD's entities itself, general and parameter,
    nested to any depth, including entities that hold markup; external
    entities and DTDs are parsed as empty and never opened or fetched. Its
    amplification limit (libexpat 2.4.0 or later; the script refuses to
    read SVG with an older one) stops billion-laughs expansions. An SVG that
    is not well-formed, or trips that limit, yields no colours; an .svg file
    is then reported as unparseable. Chrome and Firefox differ on a few DTD
    corner cases (a parameter entity that declares a general entity, an
    external parameter entity in a standalone="no" document); where either
    browser paints the colour, the guard reads it.
  - *.html, and HTML in Markdown: read by html.parser, which expands no DTD
    entities, as a browser expands none in HTML.
  - In both (an svg: prefix on tag names is ignored):
    <style> elements; style= attributes; the colour presentation attributes
    fill, stroke, stop-color, flood-color, lighting-color, color; bgcolor;
    text, link, vlink, alink on <body>; <meta name="theme-color">;
    <animate>/<set> from, to, by and values when attributeName is a colour
    attribute; shields.io badges and data: SVG in any attribute. Attribute
    values are stripped of surrounding whitespace. Comments and <script> are
    not read.
  - *.md (markdown-it-py): fenced blocks tagged css, scss, less, svg, html,
    xml, json, yaml, yml, markdown or md, read as the matching file type;
    inline HTML and HTML blocks, read as HTML; image and link URLs, read for
    shields.io badges.
  - *.json, *.yaml, *.yml: string values whose whole content is a single
    colour, e.g. `primary: "#2999a4"`. A colour mentioned inside a longer
    string is prose, not configuration, and is not read. Application YAML
    tags (!tagged_iterator and the like) are read as plain values. A JSON or
    YAML file that does not parse is reported as a finding, because its
    colours cannot be checked; a fenced json or yaml block in Markdown that
    does not parse (an excerpt with "..." in it) is skipped.

Deliberate quotes of the old values, six files, and why none is reported:
  - evals/evals.json:182 quotes #2e98a3 / #ff4e01 inside an eval prompt: a
    colour inside a longer JSON string is not read.
  - site/index.html:1079-1080 (finding F3) quotes #2999a4 / #595a62 inside a
    <script> block, which is not read.
  - site/favicon.svg:4-5 quotes them in an XML comment, which is not read.
  - .github/workflows/brand-colours.yml quotes them in a YAML comment, which
    is not read.
  - this script and Build/Scripts/tests/test_check_brand_colours.py quote
    them in Python source; *.py is not scanned.
There is therefore no exclusion list. A new deliberate quote in a place that
IS read needs one, with its path and reason, rather than a weaker metric.

Usage: check-brand-colours.py   (run from the repository root; takes no
arguments and scans every tracked file of the types above)
"""

from __future__ import annotations

import base64
import json
import re
import string
import subprocess
import sys
import xml.parsers.expat
from collections.abc import Iterator
from html.parser import HTMLParser
from urllib.parse import parse_qs, unquote, unquote_to_bytes, urlsplit

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
    "fill", "stroke", "stop-color", "flood-color", "lighting-color", "color",
}  # fmt: skip
BODY_COLOUR_ATTRIBUTES = {"text", "link", "vlink", "alink"}
ANIMATION_ATTRIBUTES = ("from", "to", "by", "values")
CSS, SVG, HTML, MARKDOWN, JSON, YAML = ".css", ".svg", ".html", ".md", ".json", ".yaml"
FENCE_LANGUAGES = {
    "css": CSS,
    "scss": CSS,
    "less": CSS,
    "svg": SVG,
    "html": HTML,
    "xml": SVG,
    "json": JSON,
    "yaml": YAML,
    "yml": YAML,
    "markdown": MARKDOWN,
    "md": MARKDOWN,
}
DATA_SCHEME = "data:"
# libexpat 2.4.0 added billion-laughs protection, on by default: a document
# whose entity expansion exceeds 100 times its input (after 8 MiB) is not
# well-formed. SVG is only read with a libexpat that has it.
EXPAT_VERSION = tuple(int(n) for n in xml.parsers.expat.version_info)
EXPAT_PROTECTED = EXPAT_VERSION >= (2, 4, 0)
# Character classes of the WHATWG specs the URL parsers below follow.
ASCII_WHITESPACE = "\t\n\f\r "
HTTP_WHITESPACE = "\n\r\t "
C0_CONTROL_OR_SPACE = "".join(chr(c) for c in range(0x21))
TAB_OR_NEWLINE = re.compile(r"[\t\n\r]")
# re.ASCII: "ASCII case-insensitive" in the spec. Without it IGNORECASE
# folds U+017F LATIN SMALL LETTER LONG S to s and U+212A KELVIN SIGN to k.
BASE64_SUFFIX = re.compile(r";\x20*base64\Z", re.IGNORECASE | re.ASCII)
BASE64_ALPHABET = re.compile(r"[A-Za-z0-9+/]*")
HTTP_TOKEN = re.compile(r"[!#$%&'*+\-.^_`|~0-9A-Za-z]+")
SRCSET_SEPARATORS = ASCII_WHITESPACE + ","
# HTML "valid non-negative integer" and "valid floating-point number";
# re.ASCII keeps \d to 0-9, as the HTML Standard's ASCII digits are.
NON_NEGATIVE_INTEGER = re.compile(r"\d+", re.ASCII)
FLOATING_POINT = re.compile(r"-?(?=\.?\d)\d*(?:\.\d+)?(?:[eE][+-]?\d+)?", re.ASCII)
# States of the srcset descriptor tokenizer.
ASCII_LOWER = str.maketrans(string.ascii_uppercase, string.ascii_lowercase)
IN_DESCRIPTOR, IN_PARENS, AFTER_DESCRIPTOR = (
    "in descriptor",
    "in parens",
    "after descriptor",
)
BARE_HEX = re.compile(r"[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?")
BADGE_EXTENSION = re.compile(r"\.(svg|png|json)\Z")
# Query parameters shields.io reads a colour from; colorA/colorB are the
# legacy names it still honours (core/base-service/coalesce-badge.js).
BADGE_QUERY_KEYS = ("color", "labelColor", "logoColor", "colorA", "colorB")
# shields.io's own colour names and aliases, which differ from the CSS names
# of the same spelling (badge-maker/lib/color.js). None is a near miss of a
# brand colour; a test pins that.
SHIELDS_NAMED_COLOURS = {
    "brightgreen": "#4b0",
    "green": "#67ac09",
    "yellow": "#d8b800",
    "yellowgreen": "#95991a",
    "orange": "#ea7233",
    "red": "#dd4343",
    "blue": "#007ec6",
    "grey": "#555",
    "lightgrey": "#939393",
    "gray": "#555",
    "lightgray": "#939393",
    "critical": "#dd4343",
    "important": "#ea7233",
    "success": "#4b0",
    "informational": "#007ec6",
    "inactive": "#939393",
}
BLOCKS = ("() block", "[] block", "{} block")


def ascii_lower(text: str) -> str:
    """ASCII lowercase (https://infra.spec.whatwg.org/#ascii-lowercase):
    only A-Z change. str.lower() also maps U+212A KELVIN SIGN to k and
    U+0130 to i plus a combining dot, which the specs' comparisons do not."""
    return text.translate(ASCII_LOWER)


class Unparsed(str):
    """A colour function coloraide could not read; its arguments are walked."""


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
        elif token.type == "function":
            yield from _function(token)
        elif token.type == "url":
            yield from data_url_colours(token.value)
        elif token.type in BLOCKS:
            yield from _walk(token.content)
        elif _is_rgb_name(meaningful, index):
            triple = _channel_triple(meaningful[index + 1 :])
            if triple:
                yield triple


def _function(token) -> Iterator[str]:
    """A colour function's value, or the colours among its arguments."""
    if token.lower_name == "url":
        for argument in token.arguments:
            if argument.type == "string":
                yield from data_url_colours(argument.value)
        return
    if token.lower_name in COLOUR_FUNCTIONS:
        text = token.serialize()
        if to_rgb(text) is not None:
            yield text
            return
        yield Unparsed(text)
    yield from _walk(token.arguments)


def _is_rgb_name(tokens: list, index: int) -> bool:
    """A --*-rgb custom property, or a $*-rgb Sass variable."""
    token = tokens[index]
    if token.type != "ident" or not token.value.endswith("-rgb"):
        return False
    if token.value.startswith("--"):
        return True
    previous = tokens[index - 1] if index else None
    return previous is not None and previous.type == "literal" and previous.value == "$"


def _channel_triple(rest: list) -> str | None:
    """`: 41, 153, 164` after a -rgb name, as `rgb(41,153,164)`."""
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


def data_url_colours(url: str) -> Iterator[str]:
    """Colours in an SVG carried by a data: URL. The body is decoded as
    UTF-8 with replacement, so a Latin-1 byte does not hide the ASCII
    markup around it; a UTF-16 SVG is not read."""
    parsed = parse_data_url(url)
    if parsed is None or parsed[0] != "image/svg+xml":
        return
    try:
        yield from svg_colours(parsed[1].decode("utf-8", errors="replace"))
    except NotWellFormed:
        return  # a browser renders nothing for it


def parse_data_url(url: str) -> tuple[str, bytes] | None:
    """(MIME type essence, body) of a data: URL, or None on failure.

    The URL Standard's basic URL parser runs first, as it does for every
    URL a browser reads (https://url.spec.whatwg.org/#concept-basic-url-parser):
    leading and trailing C0 control or space is removed, and so is every
    ASCII tab or newline. Then the Fetch Standard's data: URL processor
    (https://fetch.spec.whatwg.org/#data-url-processor), whose step numbers
    the comments below give (as published at
    fetch.spec.whatwg.org in September 2026). No maintained Python library implements it:
    w3lib's parse_data_uri and python-datauri both follow RFC 2397 and
    reject unpadded base64, "; base64" and an uppercase "BASE64".
    """
    url = TAB_OR_NEWLINE.sub("", url.strip(C0_CONTROL_OR_SPACE))
    if ascii_lower(url[: len(DATA_SCHEME)]) != DATA_SCHEME:  # 1. scheme is data
        return None
    url = url.split("#", 1)[0]  # 2. serialize, excluding the fragment
    rest = url[len(DATA_SCHEME) :]  # 3. remove the leading "data:"
    mime_type, comma, encoded_body = rest.partition(",")  # 4.-5.
    mime_type = mime_type.strip(ASCII_WHITESPACE)  # 6.
    if not comma:  # 7. position past the end: failure
        return None
    body = unquote_to_bytes(encoded_body)  # 8.-10. percent-decode the body
    base64_suffix = BASE64_SUFFIX.search(mime_type)  # 11. ";" " "* "base64"
    if base64_suffix:
        decoded = forgiving_base64_decode(body.decode("latin-1"))  # 11.1-11.2
        if decoded is None:  # 11.3
            return None
        body = decoded
        mime_type = mime_type[: base64_suffix.start()]  # 11.4-11.6
    # 12. Only the essence is used here, and a leading ";" already parses to
    # text/plain without it; the step is kept so the code follows the spec.
    if mime_type.startswith(";"):
        mime_type = "text/plain" + mime_type
    return mime_type_essence(mime_type), body  # 13.-15. (14. failure: text/plain)


def forgiving_base64_decode(data: str) -> bytes | None:
    """https://infra.spec.whatwg.org/#forgiving-base64-decode"""
    data = "".join(c for c in data if c not in ASCII_WHITESPACE)  # 1.
    if len(data) % 4 == 0:  # 2. drop one or two trailing "="
        data = data[:-2] if data.endswith("==") else data.removesuffix("=")
    if len(data) % 4 == 1:  # 3.
        return None
    if not BASE64_ALPHABET.fullmatch(data):  # 4.
        return None
    return base64.b64decode(data + "=" * (-len(data) % 4))  # 5.-10.


def mime_type_essence(text: str) -> str:
    """The essence (type/subtype, ASCII lowercase) of a MIME type, following
    https://mimesniff.spec.whatwg.org/#parse-a-mime-type steps 1-10; a
    failure is text/plain, as the data: URL processor's step 14 says."""
    text = text.strip(HTTP_WHITESPACE)  # 1.
    type_, slash, rest = text.partition("/")  # 2.-3. type; 6. skip the "/"
    subtype = rest.split(";", 1)[0].rstrip(HTTP_WHITESPACE)  # 7.-8.
    if not (slash and HTTP_TOKEN.fullmatch(type_) and HTTP_TOKEN.fullmatch(subtype)):
        return "text/plain"  # 4. bad type, 5. no "/", 9. bad subtype
    return ascii_lower(f"{type_}/{subtype}")  # 10.


def badge_colours(url: str) -> Iterator[str]:
    """The colours of an img.shields.io badge URL: path segment and query."""
    parts = urlsplit(url)
    if parts.hostname != "img.shields.io":
        return
    query = parse_qs(parts.query)  # decodes %23 and the like
    candidates = [value for key in BADGE_QUERY_KEYS for value in query.get(key, [])]
    path = unquote(parts.path)
    if path.startswith("/badge/"):
        segment = BADGE_EXTENSION.sub("", path[len("/badge/") :])
        candidates.append(segment.replace("--", "\0").split("-")[-1])
    for candidate in candidates:
        colour = _badge_colour(candidate)
        if colour is not None:
            yield colour
    for logo in query.get("logo", []):
        # shields embeds a custom logo verbatim; parse_qs turned its + into
        # spaces, and the data: prefix is optional
        logo = logo.replace(" ", "+").strip(ASCII_WHITESPACE)
        if ascii_lower(logo[: len(DATA_SCHEME)]) != DATA_SCHEME:
            logo = DATA_SCHEME + logo
        yield from data_url_colours(logo)


def _badge_colour(value: str) -> str | None:
    """A shields colour as a CSS colour: its own names first, bare hex gets #.
    shields matches its names case-sensitively (`color in namedColors`) and
    accepts CSS colour names only in lower case; a letters-only value with
    an upper-case letter (Orange, CadetBlue) renders shields' default
    colour, so it is no colour here.

    Its names and bare hex match the raw value: " 2999a4" or a no-break
    space before it renders the default (measured on img.shields.io). Any
    other value is written into the badge's fill= as it is, and the
    browser's CSS parser drops only ASCII whitespace around it, so
    " #2999a4" is #2999a4 and a U+00A0 before it is no colour."""
    if value in SHIELDS_NAMED_COLOURS:
        return SHIELDS_NAMED_COLOURS[value]
    if BARE_HEX.fullmatch(value):
        return "#" + value
    value = value.strip(ASCII_WHITESPACE)
    if value.isascii() and value.isalpha() and value != ascii_lower(value):
        return None
    return value or None


class _MarkupColours(HTMLParser):
    """Colours in the places of HTML listed in the module docstring."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.found: list[str] = []
        self._in_style = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.rsplit(":", 1)[-1]
        if tag == "style":
            self._in_style = True
        values = {name: value for name, value in attrs if value}
        for name, value in values.items():
            self.found.extend(_attribute_colours(tag, name, value, values))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag.rsplit(":", 1)[-1] == "style":
            self._in_style = False

    def handle_data(self, data: str) -> None:
        if self._in_style:
            self.found.extend(css_colours(data))


def _attribute_colours(
    tag: str, name: str, value: str, attrs: dict[str, str]
) -> Iterator[str]:
    # ASCII whitespace, as the legacy colour and URL parsers strip it; not
    # str.strip(), which also removes U+00A0 and other Unicode spaces
    value = value.strip(ASCII_WHITESPACE)
    # Any attribute, on any element and under any namespace prefix, can carry
    # a data: SVG or a badge URL (src, srcset, data, poster, background, ...).
    yield from _url_colours(name, value)
    if name == "style" or name in COLOUR_ATTRIBUTES:
        yield from css_colours(value)
    elif name == "bgcolor" or (tag == "body" and name in BODY_COLOUR_ATTRIBUTES):
        yield "#" + value if BARE_HEX.fullmatch(value) else value
    elif _is_theme_colour(tag, name, attrs) or _is_colour_animation(tag, name, attrs):
        for part in value.split(";"):
            yield from css_colours(part)


def _url_colours(name: str, value: str) -> Iterator[str]:
    """data: SVG and shields.io badges in an attribute value. An attribute
    whose name ends in srcset (srcset, imagesrcset, data-srcset) is read with
    the srcset parser; any other value is one URL."""
    urls = srcset_urls(value) if name.endswith("srcset") else [value]
    for url in urls:
        yield from data_url_colours(url)
        yield from badge_colours(url)


def srcset_urls(value: str) -> list[str]:
    """The URLs of the image candidates a srcset attribute keeps, following
    https://html.spec.whatwg.org/multipage/images.html#parse-a-srcset-attribute
    (its step labels are in the comments). A candidate whose descriptors
    the descriptor parser rejects is dropped, as the browser drops it."""
    urls: list[str] = []
    position = 0
    while True:
        # "splitting loop": skip ASCII whitespace and commas
        while position < len(value) and value[position] in SRCSET_SEPARATORS:
            position += 1
        if position >= len(value):
            return urls
        start = position  # the URL is the next run of non-whitespace
        while position < len(value) and value[position] not in ASCII_WHITESPACE:
            position += 1
        url = value[start:position]
        descriptors: list[str] = []
        if url.endswith(","):  # trailing commas end the candidate
            url = url.rstrip(",")
        else:
            descriptors, position = _srcset_descriptors(value, position)
        if url and _srcset_descriptors_valid(descriptors):
            urls.append(url)


def _srcset_descriptors(value: str, position: int) -> tuple[list[str], int]:
    """The "descriptor tokenizer"; returns the descriptors and the position
    after them. A comma outside parens ends the candidate; "after
    descriptor" reconsumes it "in descriptor", which does the same."""
    while position < len(value) and value[position] in ASCII_WHITESPACE:
        position += 1
    descriptors: list[str] = []
    current: list[str] = []  # a list, so a long descriptor stays linear
    state = IN_DESCRIPTOR
    while position < len(value):
        char = value[position]
        position += 1
        if char == "," and state != IN_PARENS:
            break
        state = _descriptor_step(state, char, current, descriptors)
    if current:
        descriptors.append("".join(current))  # end of input, or the comma
    return descriptors, position


def _descriptor_step(
    state: str, char: str, current: list[str], descriptors: list[str]
) -> str:
    """One tokenizer step for any character but a comma outside parens; it
    extends current or moves it to descriptors, and returns the next state."""
    if state == IN_PARENS:
        current.append(char)
        return IN_DESCRIPTOR if char == ")" else state
    if char in ASCII_WHITESPACE:
        if current:
            descriptors.append("".join(current))
            current.clear()
        return AFTER_DESCRIPTOR
    # "in descriptor", or "after descriptor" reconsuming it "in descriptor"
    current.append(char)
    return IN_PARENS if char == "(" else IN_DESCRIPTOR


def _srcset_descriptors_valid(descriptors: list[str]) -> bool:
    """The "descriptor parser": True when it ends with error still "no"."""
    seen: set[str] = set()
    for descriptor in descriptors:
        kind, number = descriptor[-1:], descriptor[:-1]
        if _descriptor_error(kind, number, seen):
            return False
        seen.add(kind)
    return not ("h" in seen and "w" not in seen)


def _descriptor_error(kind: str, number: str, seen: set[str]) -> bool:
    """w: width and density absent; h: future-compat-h and density absent;
    both: a valid non-negative integer other than 0. x: width, density and
    future-compat-h absent, and a valid floating-point number not below 0.
    Anything else is an error."""
    if kind in ("w", "h") and NON_NEGATIVE_INTEGER.fullmatch(number):
        blockers = {"w", "x"} if kind == "w" else {"h", "x"}
        return bool(seen & blockers) or int(number) == 0
    if kind == "x" and FLOATING_POINT.fullmatch(number):
        return bool(seen) or float(number) < 0
    return True


def _is_theme_colour(tag: str, name: str, attrs: dict[str, str]) -> bool:
    """content= of <meta name="theme-color">."""
    return (
        tag == "meta"
        and name == "content"
        and ascii_lower(attrs.get("name", "")) == "theme-color"
    )


def _is_colour_animation(tag: str, name: str, attrs: dict[str, str]) -> bool:
    """from/to/by/values of an <animate> or <set> that targets a colour."""
    return (
        tag in ("animate", "set")
        and name in ANIMATION_ATTRIBUTES
        # html.parser lower-cases attribute names; expat keeps attributeName
        and ascii_lower(attrs.get("attributename", attrs.get("attributeName", "")))
        in COLOUR_ATTRIBUTES
    )


def markup_colours(text: str) -> list[str]:
    """Colours in HTML (html.parser). An HTML document expands no DTD
    entities, in a browser or here."""
    parser = _MarkupColours()
    parser.feed(text)
    parser.close()
    return parser.found


class NotWellFormed(Exception):
    """An SVG that expat rejects; a browser renders nothing for it."""


def svg_colours(text: str) -> list[str]:
    """Colours in an SVG document, read by expat as the XML it is. expat
    expands the internal DTD's entities itself: general and parameter
    entities, nested to any depth, entities that hold markup, the first
    declaration of a name winning. Parameter-entity parsing is on, so a
    parameter-entity reference does not stop the reading of later
    declarations; an external entity or DTD is parsed as empty and never
    opened. A document that is not well-formed raises NotWellFormed, and so
    does one whose expansion trips libexpat's amplification limit."""
    if not EXPAT_PROTECTED:
        raise RuntimeError(
            f"libexpat {'.'.join(map(str, EXPAT_VERSION))} has no billion-laughs "
            "protection (2.4.0 or later needed); refusing to read SVG"
        )
    reader = _SvgColours()
    parser = xml.parsers.expat.ParserCreate()
    parser.SetParamEntityParsing(xml.parsers.expat.XML_PARAM_ENTITY_PARSING_ALWAYS)
    parser.ExternalEntityRefHandler = _empty_external_entity(parser)
    parser.StartElementHandler = reader.start
    parser.EndElementHandler = reader.end
    parser.CharacterDataHandler = reader.text
    try:
        parser.Parse(text, True)
    except xml.parsers.expat.ExpatError as error:
        raise NotWellFormed(str(error)) from error
    return reader.found


def _empty_external_entity(parser: object):
    """An ExternalEntityRefHandler that parses every external entity and the
    external DTD subset as an empty document: nothing is opened or fetched."""

    def handler(context: str, _base: object, _system: object, _public: object) -> int:
        external = parser.ExternalEntityParserCreate(context)
        external.Parse("", True)
        return 1

    return handler


class _SvgColours:
    """expat handlers: attributes of every element, text of <style>."""

    def __init__(self) -> None:
        self.found: list[str] = []
        self._style: list[str] | None = None

    def start(self, tag: str, attrs: dict[str, str]) -> None:
        tag = tag.rsplit(":", 1)[-1]
        if tag == "style":
            self._style = []
        values = {name: value for name, value in attrs.items() if value}
        for name, value in values.items():
            self.found.extend(_attribute_colours(tag, name, value, values))

    def end(self, tag: str) -> None:
        if tag.rsplit(":", 1)[-1] == "style" and self._style is not None:
            self.found.extend(css_colours("".join(self._style)))
            self._style = None

    def text(self, data: str) -> None:
        if self._style is not None:
            self._style.append(data)


def markdown_colours(text: str) -> Iterator[str]:
    for token in MarkdownIt().parse(text):
        if token.type == "fence":
            language = ascii_lower((token.info.split() or [""])[0])
            kind = FENCE_LANGUAGES.get(language)
            if kind:
                yield from _fence_colours(kind, token.content)
        elif token.type == "html_block":
            yield from markup_colours(token.content)
        elif token.type == "inline":
            yield from _inline_colours(token.children or [])


def _fence_colours(kind: str, text: str) -> Iterator[str]:
    try:
        yield from list(colours_in(kind, text))
    except (json.JSONDecodeError, yaml.YAMLError, NotWellFormed):
        return


def _inline_colours(children: list) -> Iterator[str]:
    for child in children:
        if child.type == "html_inline":
            yield from markup_colours(child.content)
        elif child.type in ("image", "link_open"):
            yield from badge_colours(
                str(child.attrGet("src") or child.attrGet("href") or "")
            )


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
        values = [v for v in css_colours(text) if not isinstance(v, Unparsed)]
        tokens = [
            t
            for t in tinycss2.parse_component_value_list(text, skip_comments=True)
            if t.type != "whitespace"
        ]
        if len(values) == 1 and len(tokens) == 1:
            yield values[0]


def colours_in(kind: str, text: str) -> Iterator[str]:
    if kind in (CSS, ".scss"):
        yield from css_colours(text)
    elif kind == SVG:
        yield from svg_colours(text)
    elif kind == HTML:
        yield from markup_colours(text)
    elif kind == MARKDOWN:
        yield from markdown_colours(text)
    elif kind == JSON:
        yield from data_colours([json.loads(text)])
    elif kind in (YAML, ".yml"):
        yield from data_colours(list(yaml.load_all(text, Loader=_TaggedSafeLoader)))


class _TaggedSafeLoader(yaml.SafeLoader):
    """SafeLoader that reads application tags (!tagged_iterator, !php/const,
    !reference) as plain values instead of refusing the whole file."""


def _plain_node(loader: yaml.SafeLoader, _suffix: str, node: yaml.Node) -> object:
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_scalar(node)


_TaggedSafeLoader.add_multi_constructor("!", _plain_node)


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


def scan(path: str, text: str) -> tuple[int, int, list[str]]:
    """(colour values read, unparsed colour functions, near-miss messages)."""
    kind = "." + ascii_lower(path.rsplit(".", 1)[-1])
    try:
        found = list(colours_in(kind, text))
    except (json.JSONDecodeError, yaml.YAMLError, NotWellFormed) as error:
        reason = str(error).splitlines()[0]
        return 0, 0, [f"{path}: does not parse ({reason}); its colours were not read"]
    values = [v for v in found if not isinstance(v, Unparsed)]
    messages = []
    for value in values:
        match = near_miss(value)
        if match:
            brand, distance, delta_e = match
            messages.append(
                f"{path}: {value} is a near miss of {brand} ({BRAND[brand]}; "
                f"channel distance {distance}, dE00 {delta_e:.2f}); use {brand}"
            )
    return len(values), len(found) - len(values), messages


def findings_in(path: str, text: str) -> tuple[int, list[str]]:
    """(number of colour values read, near-miss messages) for one file."""
    count, _, messages = scan(path, text)
    return count, messages


def tracked_files() -> list[str]:
    """Tracked files of the scanned types. -z: git then neither quotes nor
    escapes a path with a space or a non-ASCII character."""
    result = subprocess.run(
        ["git", "ls-files", "-z", *PATTERNS], capture_output=True, text=True, check=True
    )
    return [path for path in result.stdout.split("\0") if path]


def main() -> int:
    files = tracked_files()
    if not files:
        print("check-brand-colours: no files found", file=sys.stderr)
        return 2
    findings: list[str] = []
    read = unparsed = 0
    for path in files:
        with open(path, encoding="utf-8") as handle:
            count, skipped, messages = scan(path, handle.read())
        read += count
        unparsed += skipped
        findings.extend(messages)
    for message in findings:
        print(message)
    print(
        f"check-brand-colours: {len(files)} files, {read} colour values, "
        f"{unparsed} unparsed colour functions (arguments walked), "
        f"{len(findings)} finding(s)"
    )
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
