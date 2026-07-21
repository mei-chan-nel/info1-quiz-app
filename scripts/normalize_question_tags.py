from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from tag_normalization import CANONICAL_TAGS, TAG_ALIASES, normalize_tags


ROOT = Path(__file__).resolve().parents[1]
QUESTION_PATH = ROOT / "data" / "questions" / "completed_questions.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize classification tags without changing question content.")
    parser.add_argument("--apply", action="store_true", help="Write normalized tags back to the question source")
    args = parser.parse_args()

    questions = json.loads(QUESTION_PATH.read_text(encoding="utf-8"))
    before = Counter(str(tag).strip() for question in questions for tag in question.get("tags", []))
    changed_questions = 0
    removed_duplicates = 0

    for question in questions:
        original = [str(tag).strip() for tag in question.get("tags", []) if str(tag).strip()]
        normalized = normalize_tags(original)
        if normalized != original:
            changed_questions += 1
            removed_duplicates += len(original) - len(normalized)
            question["tags"] = normalized

    after = Counter(str(tag).strip() for question in questions for tag in question.get("tags", []))
    tracked = [*TAG_ALIASES, *CANONICAL_TAGS]
    print(f"questions={len(questions)} changed={changed_questions} duplicates_removed={removed_duplicates}")
    for tag in dict.fromkeys(tracked):
        print(f"{tag}: {before[tag]} -> {after[tag]}")

    if not changed_questions:
        return 0
    if not args.apply:
        print("Run with --apply to update classification tags.")
        return 1

    QUESTION_PATH.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
