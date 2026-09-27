#!/usr/bin/env python3
"""Fail when a shipped SVG or CSS asset uses a near-miss of a brand colour.

references/logo.md states that #2F99A4 (frame) and #585961 (letter) are the
only valid colour values for the symbol, and that a close approximation is
brand debt. The canonical symbol shipped #2999a4 and #595a62 for a long time
without anything noticing, so this check looks for exactly that class: a hex
colour close to a brand colour but not equal to it.

"Close" means every RGB channel is within NEAR_MISS of the brand value. The
threshold comes from measurement: the two defects it was written for sit at a
channel distance of 6 (#2999a4) and 1 (#595a62), while the nearest documented,
intentional variant, #4D4F57 in references/colors.md, sits at 11 from #585961.
Colours further away are other palette entries or deliberate variants and are
not this check's business.

Only rendered values are read: attributes and <style> bodies of SVG files
(parsed as XML, so comments are ignored) and CSS files with comments removed.
Documentation and eval prompts quote wrong values on purpose and are not
scanned.

Usage: check-brand-colours.py   (run from the repository root; takes no
arguments and scans every tracked *.svg and *.css file)
"""

from __future__ import annotations

import re
import subprocess
import sys
import xml.etree.ElementTree as ET

BRAND = {
    "2F99A4": "primary turquoise",
    "585961": "text anthracite",
    "FF4D00": "accent orange",
}
NEAR_MISS = 8
HEX = re.compile(r"#([0-9a-fA-F]{6})(?![0-9a-fA-F])")
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)


def rgb(value: str) -> tuple[int, int, int]:
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def near_miss(value: str) -> str | None:
    """Return the brand colour VALUE nearly matches, or None."""
    upper = value.upper()
    for brand in BRAND:
        distance = max(abs(a - b) for a, b in zip(rgb(upper), rgb(brand)))
        if 0 < distance <= NEAR_MISS:
            return brand
    return None


def rendered_text(path: str) -> list[str]:
    """The parts of PATH that end up in a rendering."""
    with open(path, encoding="utf-8") as handle:
        source = handle.read()
    if path.endswith(".css"):
        return [CSS_COMMENT.sub("", source)]
    chunks: list[str] = []
    for element in ET.fromstring(source).iter():
        chunks.extend(element.attrib.values())
        if element.tag.endswith("style") and element.text:
            chunks.append(CSS_COMMENT.sub("", element.text))
    return chunks


def tracked_assets() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "*.svg", "*.css"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.split()


def main() -> int:
    files = tracked_assets()
    if not files:
        print("check-brand-colours: no SVG or CSS files found", file=sys.stderr)
        return 2
    findings = 0
    for path in files:
        for chunk in rendered_text(path):
            for match in HEX.finditer(chunk):
                brand = near_miss(match.group(1))
                if brand:
                    findings += 1
                    print(
                        f"{path}: #{match.group(1)} is a near miss of "
                        f"#{brand} ({BRAND[brand]}); use #{brand}"
                    )
    print(f"check-brand-colours: {len(files)} files, {findings} finding(s)")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
