from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from tag_normalization import TAG_ALIASES, normalize_tag, normalize_tags


class TagNormalizationTest(unittest.TestCase):
    def test_required_spellings_share_one_canonical_definition(self) -> None:
        self.assertEqual(normalize_tag("ユーザインターフェース"), "ユーザインタフェース")
        self.assertEqual(normalize_tag("クライアント・サーバシステム"), "クライアント/サーバシステム")
        self.assertEqual(
            normalize_tags(["ユーザインターフェース", "ユーザインタフェース"]),
            ["ユーザインタフェース"],
        )

    def test_question_source_contains_only_canonical_tags(self) -> None:
        questions = json.loads(
            (ROOT / "data" / "questions" / "completed_questions.json").read_text(encoding="utf-8")
        )
        used_tags = {
            str(tag).strip()
            for question in questions
            for tag in question.get("tags", [])
            if str(tag).strip()
        }
        self.assertTrue(set(TAG_ALIASES).isdisjoint(used_tags))

    def test_generated_filter_displays_canonical_tags_and_embeds_legacy_aliases(self) -> None:
        html = (ROOT / "questions" / "tags.html").read_text(encoding="utf-8")
        aliases_json = json.dumps(TAG_ALIASES, ensure_ascii=False, separators=(",", ":"))
        escaped_aliases = aliases_json.replace("&", "&amp;").replace('"', "&quot;")
        self.assertIn(f'data-tag-aliases="{escaped_aliases}"', html)
        self.assertIn('data-facet-value="ユーザインタフェース"', html)
        self.assertIn('data-facet-value="クライアント/サーバシステム"', html)
        self.assertNotIn('data-facet-value="ユーザインターフェース"', html)
        self.assertNotIn('data-facet-value="クライアント・サーバシステム"', html)


if __name__ == "__main__":
    unittest.main()
