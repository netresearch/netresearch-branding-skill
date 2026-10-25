# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: Netresearch DTT GmbH
"""Keep decision grading independent of equivalent Markdown formatting."""

import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NAMES = {
    "gradient-incomplete-with-text-crossing-motif",
    "standalone-family-shared-shell-acceptance",
}
CONFLICTS = {
    "gradient-incomplete-with-text-crossing-motif": {
        "A": ("FAIL", "PASS"),
        "B": ("UNRESOLVED", "PASS"),
        "C": ("UNRESOLVED", "FAIL"),
        "SCOPE": ("FULL-WCAG",),
    },
    "standalone-family-shared-shell-acceptance": {
        "A": ("ACCEPT_SCOPED",),
        "B": ("HOLD",),
        "HOSTED": ("APPLY_STANDALONE",),
    },
}
PREFIX = re.compile(
    r"^[ \t]*(?:(?:[-+*]|[0-9]+[.)])[ \t]+)?(?:#+[ \t]+)?"
    r"[_*]*([A-Z]+)[ \t_*]*:[ \t_*]*([A-Z]+(?:[_-][A-Z]+)*)[_*]*",
    re.MULTILINE,
)
FORMATS = (
    "{label}: {verdict}",
    "**{label}: {verdict}**",
    "{label}: **{verdict}**",
    "**{label}:** {verdict}",
    "## {label}: {verdict}",
    "  {label}:  **{verdict}**",
    "_{label}: {verdict}_",
    "{label}: _{verdict}_",
    "_{label}:_ {verdict}",
    "**{label}**: {verdict}",
    "_{label}_: {verdict}",
    "__{label}__: __{verdict}__",
    "* {label}: {verdict}",
    "- {label}: {verdict}",
    "+ {label}: {verdict}",
    "1. {label}: {verdict}",
    "1) {label}: {verdict}",
    "* _{label}_: _{verdict}_",
    "1. **{label}**: **{verdict}**",
    "**{label}** : _{verdict}_",
)


def format_answer(answer, template):
    return PREFIX.sub(
        lambda match: template.format(label=match[1], verdict=match[2]), answer
    )


def passes(case, answer):
    for assertion in case["assertions"]:
        pattern = assertion.get("value") or assertion["pattern"]
        pattern = pattern.removeprefix("(?i)")
        result = subprocess.run(
            ["grep", "-qiE", "--", pattern],
            input=answer,
            text=True,
            capture_output=True,
            check=False,
        )
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
        for case in cls.cases:
            labels = [match[1] for match in PREFIX.finditer(case["samples"]["passing"])]
            if set(labels) != set(CONFLICTS[case["name"]]) or len(labels) != len(
                set(labels)
            ):
                raise ValueError(
                    "Passing sample decisions were not parsed exactly once"
                )

    def test_passing_decisions_survive_equivalent_formatting(self):
        for case in self.cases:
            for template in FORMATS:
                with self.subTest(case=case["name"], template=template):
                    self.assertTrue(
                        passes(
                            case, format_answer(case["samples"]["passing"], template)
                        )
                    )

    def test_wrong_decisions_remain_rejected_in_every_format(self):
        for case in self.cases:
            for index, answer in enumerate(case["samples"]["failing"]):
                for template in FORMATS:
                    with self.subTest(
                        case=case["name"], sample=index, template=template
                    ):
                        self.assertFalse(passes(case, format_answer(answer, template)))

    def test_conflicting_additional_verdicts_are_rejected(self):
        for case in self.cases:
            correct = case["samples"]["passing"]
            for label, alternatives in CONFLICTS[case["name"]].items():
                for verdict in alternatives:
                    for template in FORMATS:
                        line = template.format(label=label, verdict=verdict)
                        for answer in (correct + "\n" + line, line + "\n" + correct):
                            with self.subTest(
                                case=case["name"],
                                label=label,
                                verdict=verdict,
                                template=template,
                            ):
                                self.assertFalse(passes(case, answer))

    def test_repeated_consistent_verdicts_are_valid(self):
        for case in self.cases:
            correct = case["samples"]["passing"]
            for match in PREFIX.finditer(correct):
                for template in FORMATS:
                    line = template.format(label=match[1], verdict=match[2])
                    with self.subTest(
                        case=case["name"], label=match[1], template=template
                    ):
                        self.assertTrue(passes(case, correct + "\n" + line))

    def test_each_observation_requires_its_own_verdict(self):
        for case in self.cases:
            correct = format_answer(case["samples"]["passing"], "{label}: {verdict}")
            for label in CONFLICTS[case["name"]]:
                answer = PREFIX.sub(
                    lambda match, label=label: (
                        f"{label}: (no verdict)" if match[1] == label else match[0]
                    ),
                    correct,
                )
                with self.subTest(case=case["name"], label=label):
                    self.assertFalse(passes(case, answer))

    def test_verdict_prefixes_are_not_the_complete_verdict(self):
        for case in self.cases:
            for suffix in ("X", "_EXTRA"):
                answer = format_answer(
                    case["samples"]["passing"], "{label}: {verdict}" + suffix
                )
                with self.subTest(case=case["name"], suffix=suffix):
                    self.assertFalse(passes(case, answer))

    def test_expected_words_without_decision_labels_are_insufficient(self):
        for case in self.cases:
            answer = PREFIX.sub(lambda match: match[2], case["samples"]["passing"])
            with self.subTest(case=case["name"]):
                self.assertFalse(passes(case, answer))


if __name__ == "__main__":
    unittest.main()
