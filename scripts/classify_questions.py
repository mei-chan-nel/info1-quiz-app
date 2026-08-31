from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTION_PATH = ROOT / "data" / "questions" / "completed_questions.json"
REPORT_DIR = ROOT / "docs" / "reports"

FIELD_LABELS = {
    "society_security": "社会・セキュリティ",
    "digital": "デジタル表現",
    "network": "ネットワーク",
    "data_db": "データ活用・DB",
    "algorithm": "アルゴリズム",
    "design": "情報デザイン",
}

OBSOLETE_QUESTION_FIELDS = (
    "primary_term_names",
    "correct_choice",
    "source_question_ids",
    "curation_status",
    "adoption_status",
    "evaluation_class",
    "evaluation_reasons",
)


def load_questions() -> list[dict]:
    with QUESTION_PATH.open(encoding="utf-8") as file:
        value = json.load(file)
    if not isinstance(value, list):
        raise ValueError("Question data must be a JSON array")
    return value


def validate_required_fields(questions: list[dict]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            errors.append(f"index:{index}: question must be an object")
            continue
        question_id = question.get("id")
        if not isinstance(question_id, str) or not question_id.strip():
            errors.append(f"index:{index}: id must be a non-empty string")
            question_label = f"index:{index}"
        else:
            question_label = question_id
            if question_id in seen_ids:
                errors.append(f"{question_id}: duplicate id")
            seen_ids.add(question_id)
        for field in ("stem", "explanation"):
            value = question.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{question_label}: {field} must be a non-empty string")
    return errors


def validate_tags(questions: list[dict]) -> list[str]:
    errors: list[str] = []
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            continue
        question_id = str(question.get("id") or f"index:{index}")
        tags = question.get("tags")
        if not isinstance(tags, list):
            errors.append(f"{question_id}: tags must be an array")
            continue
        for tag_index, tag in enumerate(tags):
            if not isinstance(tag, str) or not tag.strip():
                errors.append(f"{question_id}: tags[{tag_index}] must be a non-empty string")
    return errors


def validate_field_ids(questions: list[dict]) -> list[str]:
    errors: list[str] = []
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            continue
        question_id = str(question.get("id") or f"index:{index}")
        field_ids = question.get("field_ids")
        if not isinstance(field_ids, list) or len(field_ids) != 1:
            errors.append(f"{question_id}: field_ids must contain exactly one value")
            continue
        if field_ids[0] not in FIELD_LABELS:
            errors.append(f"{question_id}: unknown field_id: {field_ids[0]}")
    return errors


def validate_obsolete_fields(questions: list[dict]) -> list[str]:
    errors: list[str] = []
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            continue
        question_id = str(question.get("id") or f"index:{index}")
        for field in OBSOLETE_QUESTION_FIELDS:
            if field in question:
                errors.append(f"{question_id}: obsolete {field} field is forbidden")
    return errors


def validate_answer_and_source(questions: list[dict]) -> list[str]:
    errors: list[str] = []
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            continue
        question_id = str(question.get("id") or f"index:{index}")
        choices = question.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            errors.append(f"{question_id}: choices must contain at least two values")
        else:
            answer_choice_id = question.get("answer_choice_id")
            if not isinstance(answer_choice_id, str) or not answer_choice_id.strip():
                errors.append(f"{question_id}: answer_choice_id must be a non-empty string")
            else:
                answer_matches = [
                    choice for choice in choices
                    if isinstance(choice, dict) and choice.get("choice_id") == answer_choice_id
                ]
                if len(answer_matches) != 1:
                    errors.append(f"{question_id}: answer_choice_id must match exactly one choice_id")
                correct_choices = [
                    choice for choice in choices
                    if isinstance(choice, dict) and choice.get("is_correct") is True
                ]
                if len(correct_choices) != 1 or not answer_matches or correct_choices[0] is not answer_matches[0]:
                    errors.append(f"{question_id}: choices[].is_correct must agree with answer_choice_id")
        source_display = question.get("source_display")
        if not isinstance(source_display, str) or not source_display.strip():
            errors.append(f"{question_id}: source_display must be a non-empty string")
    return errors


def validate_question_data(questions: list[dict]) -> list[str]:
    return [
        *validate_obsolete_fields(questions),
        *validate_required_fields(questions),
        *validate_tags(questions),
        *validate_answer_and_source(questions),
        *validate_field_ids(questions),
    ]


def field_records(questions: list[dict]) -> list[dict]:
    return [
        {
            "question_id": str(question["id"]),
            "field_id": str(question["field_ids"][0]),
            "field_label": FIELD_LABELS[str(question["field_ids"][0])],
        }
        for question in questions
    ]


def write_reports(records: list[dict]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "field-classification.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    counts = Counter(record["field_id"] for record in records)
    lines = [
        "# 分野ID検証レポート",
        "",
        "生成元: `scripts/classify_questions.py`",
        "",
        "## 集計",
        "",
        f"- 全問題: {len(records)}問",
        "- 未分類・不正な分野ID: 0問",
    ]
    for field_id, label in FIELD_LABELS.items():
        lines.append(f"- {label}: {counts[field_id]}問")
    lines.extend(
        [
            "",
            "## 運用ルール",
            "",
            "- `field_ids` を各問題の確定済み主分野の正本とする。",
            "- `field_ids` は許可された6分野のうち1要素だけを含む配列とする。",
            "- `tags` は問題に付与する用語・検索情報の正本とする。",
            "- タグや問題文のキーワードから主分野を再推定しない。",
            "",
        ]
    )
    (REPORT_DIR / "field-classification-review.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the canonical field_ids assigned to every question.")
    parser.add_argument("--check", action="store_true", help="Validate question data and existing field_ids")
    parser.parse_args()

    questions = load_questions()
    errors = validate_question_data(questions)
    if errors:
        raise SystemExit("\n".join(errors))

    records = field_records(questions)
    write_reports(records)
    counts = Counter(record["field_id"] for record in records)
    print(f"validated={len(records)}")
    print(" ".join(f"{field_id}={counts[field_id]}" for field_id in FIELD_LABELS))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
