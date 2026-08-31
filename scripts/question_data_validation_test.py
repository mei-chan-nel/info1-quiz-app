from __future__ import annotations

import json
import unittest
from pathlib import Path

from classify_questions import validate_question_data


ROOT = Path(__file__).resolve().parents[1]


def valid_question() -> dict:
    return {
        "id": "q-1",
        "choices": [
            {"choice_id": "q-1__choice_0", "is_correct": True},
            {"choice_id": "q-1__choice_1", "is_correct": False},
        ],
        "answer_choice_id": "q-1__choice_0",
        "stem": "ビットについて答えよ。",
        "explanation": "ビットは情報量の単位である。",
        "tags": ["ビット"],
        "source_display": "オリジナル",
        "field_ids": ["digital"],
    }


class QuestionDataValidationTest(unittest.TestCase):
    def test_valid_question_is_accepted(self) -> None:
        self.assertEqual(validate_question_data([valid_question()]), [])

    def test_obsolete_question_fields_are_rejected(self) -> None:
        obsolete_fields = (
            "primary_term_names",
            "correct_choice",
            "source_question_ids",
            "curation_status",
            "adoption_status",
            "evaluation_class",
            "evaluation_reasons",
        )
        for field in obsolete_fields:
            with self.subTest(field=field):
                question = valid_question()
                question[field] = None
                self.assertTrue(
                    any(f"obsolete {field} field is forbidden" in error for error in validate_question_data([question]))
                )

    def test_answer_choice_id_and_is_correct_must_agree(self) -> None:
        question = valid_question()
        question["answer_choice_id"] = "q-1__choice_1"
        self.assertTrue(
            any("choices[].is_correct must agree with answer_choice_id" in error for error in validate_question_data([question]))
        )

    def test_source_display_must_not_be_blank(self) -> None:
        question = valid_question()
        question["source_display"] = " "
        self.assertTrue(
            any("source_display must be a non-empty string" in error for error in validate_question_data([question]))
        )

    def test_tags_must_be_an_array_of_non_empty_strings(self) -> None:
        question = valid_question()
        question["tags"] = [""]
        self.assertTrue(
            any("tags[0] must be a non-empty string" in error for error in validate_question_data([question]))
        )

    def test_completed_questions_use_only_current_top_level_fields(self) -> None:
        questions = json.loads(
            (ROOT / "data" / "questions" / "completed_questions.json").read_text(encoding="utf-8")
        )
        expected_fields = {
            "id",
            "stem",
            "choices",
            "answer_choice_id",
            "explanation",
            "tags",
            "difficulty",
            "source_display",
            "改題",
            "field_ids",
        }
        for question in questions:
            with self.subTest(question_id=question.get("id")):
                self.assertEqual(set(question), expected_fields)

    def test_schema_forbids_obsolete_term_fields(self) -> None:
        schema = json.loads(
            (ROOT / "data" / "questions" / "question.schema.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            schema["required"],
            ["id", "stem", "choices", "answer_choice_id", "explanation", "tags", "source_display", "field_ids"],
        )
        self.assertEqual(
            set(schema["properties"]),
            {"id", "stem", "choices", "answer_choice_id", "explanation", "tags", "source_display", "field_ids"},
        )
        forbidden_fields = {
            clause["required"][0]
            for clause in schema["not"]["anyOf"]
        }
        self.assertEqual(
            forbidden_fields,
            {
                "primary_term_names",
                "correct_choice",
                "source_question_ids",
                "curation_status",
                "adoption_status",
                "evaluation_class",
                "evaluation_reasons",
            },
        )


if __name__ == "__main__":
    unittest.main()
