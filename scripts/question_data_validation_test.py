from __future__ import annotations

import json
import unittest
from pathlib import Path

from classify_questions import validate_question_data


ROOT = Path(__file__).resolve().parents[1]


def valid_question() -> dict:
    return {
        "id": "q-1",
        "field_ids": ["digital"],
        "primary_terms": [
            {
                "term_id": "T0001",
                "term": "ビット",
                "category": "デジタル表現",
                "code": "2ア",
                "matched_variant": "bit",
            }
        ],
    }


class QuestionDataValidationTest(unittest.TestCase):
    def test_valid_primary_terms_are_accepted(self) -> None:
        self.assertEqual(validate_question_data([valid_question()]), [])

    def test_obsolete_primary_term_names_are_rejected(self) -> None:
        question = valid_question()
        question["primary_term_names"] = ["ビット"]
        self.assertTrue(
            any("obsolete primary_term_names field is forbidden" in error for error in validate_question_data([question]))
        )

    def test_primary_term_shape_is_enforced(self) -> None:
        question = valid_question()
        question["primary_terms"][0].pop("term")
        self.assertTrue(
            any("primary_terms[0] is missing fields: ['term']" in error for error in validate_question_data([question]))
        )

    def test_schema_declares_primary_terms_and_forbids_obsolete_field(self) -> None:
        schema = json.loads(
            (ROOT / "data" / "questions" / "question.schema.json").read_text(encoding="utf-8")
        )
        self.assertIn("primary_terms", schema["required"])
        self.assertEqual(schema["not"]["required"], ["primary_term_names"])
        self.assertEqual(
            schema["properties"]["primary_terms"]["items"]["required"],
            ["term_id", "term", "category", "code", "matched_variant"],
        )


if __name__ == "__main__":
    unittest.main()
