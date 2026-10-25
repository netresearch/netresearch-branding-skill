# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: Netresearch DTT GmbH
"""Keep decision grading independent of equivalent Markdown formatting."""
import json
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
NAMES = {"gradient-incomplete-with-text-crossing-motif", "standalone-family-shared-shell-acceptance"}
PREFIX = re.compile(r"^[*]*([A-Z]+):[ \t*]*([A-Z][A-Z_-]*)[*]*", re.MULTILINE)
FORMATS = (
    "{label}: {verdict}",
    "**{label}: {verdict}**",
    "{label}: **{verdict}**",
    "**{label}:** {verdict}",
    "## {label}: {verdict}",
    "  {label}:  **{verdict}**",
)


def format_answer(answer, template):
    return PREFIX.sub(lambda match: template.format(label=match[1], verdict=match[2]), answer)


def passes(case, answer):
    for assertion in case["assertions"]:
        pattern = assertion.get("value") or assertion["pattern"]
        if pattern.startswith("(?i)"):
            pattern = pattern[4:]
        result = subprocess.run(["grep", "-qiE", "--", pattern], input=answer, text=True, capture_output=True)
        if result.returncode not in (0, 1):
            raise ValueError(result.stderr)
        matched = result.returncode == 0
        if matched == (assertion["type"] == "must_not"):
            return False
    return True


class EvalSampleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cases = json.loads((ROOT / "evals/evals.json").read_text(encoding="utf-8"))
        cls.cases = [case for case in cases if case["name"] in NAMES]
        if {case["name"] for case in cls.cases} != NAMES:
            raise ValueError("Missing regression eval")

    def test_passing_decisions_survive_equivalent_formatting(self):
        for case in self.cases:
            for template in FORMATS:
                with self.subTest(case=case["name"], template=template):
                    self.assertTrue(passes(case, format_answer(case["samples"]["passing"], template)))

    def test_wrong_decisions_remain_rejected_in_every_format(self):
        for case in self.cases:
            for index, answer in enumerate(case["samples"]["failing"]):
                for template in FORMATS:
                    with self.subTest(case=case["name"], sample=index, template=template):
                        self.assertFalse(passes(case, format_answer(answer, template)))

    def test_verdict_prefixes_are_not_the_complete_verdict(self):
        for case in self.cases:
            answer = format_answer(case["samples"]["passing"], "{label}: {verdict}X")
            with self.subTest(case=case["name"]):
                self.assertFalse(passes(case, answer))

    def test_expected_words_without_decision_labels_are_insufficient(self):
        for case in self.cases:
            answer = PREFIX.sub(lambda match: match[2], case["samples"]["passing"])
            with self.subTest(case=case["name"]):
                self.assertFalse(passes(case, answer))


if __name__ == "__main__":
    unittest.main()
