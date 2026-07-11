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

# Keep these in sync with app/app.js. They intentionally reproduce the app's
# former fallback inference so the original 69-question gap remains auditable.
APP_NEEDLES = {
    "society_security": [
        "情報社会", "情報セキュリティ", "著作権", "肖像権", "個人情報", "不正アクセス",
        "フィッシング", "マルウェア", "認証", "パスワード", "暗号", "ディジタル署名",
        "デジタル署名", "バックアップ", "機密性", "完全性", "可用性", "アクセス制御", "ハッシュ",
    ],
    "digital": [
        "bit", "ビット", "バイト", "2進数", "16進数", "データ量", "デジタル表現", "画像",
        "音声", "動画", "標本化", "量子化", "符号化", "圧縮", "論理演算", "AND", "OR",
        "XOR", "CPU", "主記憶", "ファイル",
    ],
    "network": [
        "ネットワーク", "IPアドレス", "IPv4", "IPv6", "DNS", "DHCP", "TCP", "UDP",
        "パケット", "LAN", "Web", "Webページ", "URL", "HTTP", "E-mail", "電子メール",
    ],
    "data_db": [
        "データ活用", "データベース", "RDB", "主キー", "外部キー", "フィールド", "レコード",
        "テーブル", "平均", "中央値", "最頻値", "標準偏差", "グラフ", "欠損", "外れ値", "匿名",
    ],
    "algorithm": [
        "プログラム", "アルゴリズム", "条件分岐", "繰返し", "変数", "配列", "探索", "並べ替え",
        "シミュレーション", "確率", "チェックディジット", "関数", "フローチャート",
    ],
    "design": [
        "情報デザイン", "ユーザインタフェース", "UI", "アクセシビリティ", "可読性", "視認性",
        "入力", "ピクトグラム",
    ],
}

DOMAIN_TAGS = {
    "society_security": {"情報社会", "情報セキュリティ", "情報モラル"},
    "digital": {"デジタル表現", "ディジタル表現", "デジタル", "ディジタル", "コンピュータ"},
    "network": {"ネットワーク", "情報通信ネットワーク"},
    "data_db": {"データ活用", "データベース", "統計", "データサイエンス"},
    "algorithm": {"アルゴリズム", "プログラミング", "モデル化", "シミュレーション"},
    "design": {"情報デザイン", "デザイン"},
}

# These are the 69 questions for which the app's historical keyword inference
# returned no candidate. Each group was reviewed by its actual learning focus.
MANUAL_REVIEW_GROUPS = {
    "society_security": {
        "reason": "情報社会における問題解決・調査・協働・制度を主題とするため",
        "ids": [
            "center_style_ip_curated_058", "center_style_ap_curated_104",
            "center_style_curated_065_005", "center_style_curated_065_014",
            "center_style_curated_067_003", "center_style_curated_067_012",
            "center_style_curated_067_019", "center_style_curated_074_013",
            "center_style_curated_084_004", "simple_original_005", "simple_original_006",
            "simple_original_009", "simple_original_010",
        ],
    },
    "digital": {
        "reason": "コンピュータ構成・メディア表現・数値表現を主題とするため",
        "ids": [
            "center_style_common_test_0026", "center_style_ip_curated_053",
            "center_style_ip_curated_108", "center_style_ap_curated_089",
            "center_style_fe_curated_074", "center_style_ip_curated_129",
            "center_style_ip_curated_139", "center_style_fe_curated_076",
            "center_style_fe_curated_080", "center_style_curated_065_010",
            "center_style_curated_073_018", "center_style_curated_075_003",
            "center_style_curated_077_002", "center_style_curated_081_002",
            "center_style_curated_082_003", "center_style_curated_084_018",
            "center_style_curated_085_006", "center_style_curated_085_012",
            "original_knowledge_0027", "simple_original_091", "simple_original_092",
            "simple_original_093", "simple_original_094", "simple_original_096",
            "simple_original_100", "simple_original_102", "simple_original_103",
        ],
    },
    "network": {
        "reason": "情報を結ぶ通信経路の構成を主題とするため",
        "ids": ["center_style_ip_curated_131"],
    },
    "data_db": {
        "reason": "統計・表計算・データ整形・機械学習によるデータ活用を主題とするため",
        "ids": [
            "center_style_ip_curated_023", "center_style_ip_curated_048",
            "center_style_ip_curated_051", "center_style_ip_curated_054",
            "center_style_ip_curated_055", "center_style_ap_curated_067",
            "center_style_ap_curated_068", "center_style_ip_curated_086",
            "center_style_ip_curated_105", "center_style_ap_curated_105",
            "center_style_ip_curated_214", "center_style_curated_064_009",
            "center_style_curated_069_011", "center_style_curated_074_002",
        ],
    },
    "algorithm": {
        "reason": "計算手順・プログラム・センサと制御の仕組みを主題とするため",
        "ids": [
            "center_style_seed_0030", "center_style_common_test_0031",
            "center_style_common_test_0041", "center_style_ap_0004",
            "center_style_fe_curated_066", "center_style_fe_curated_072",
            "center_style_fe_curated_073", "center_style_ap_curated_097",
            "center_style_curated_075_001", "center_style_curated_081_004",
            "center_style_curated_085_008", "simple_original_097",
            "simple_original_113", "simple_original_117",
        ],
    },
    "design": {"reason": "情報デザインを主題とするため", "ids": []},
}


def load_questions() -> list[dict]:
    with QUESTION_PATH.open(encoding="utf-8") as file:
        value = json.load(file)
    if not isinstance(value, list):
        raise ValueError("Question data must be a JSON array")
    return value


def searchable_parts(question: dict) -> tuple[list[str], list[str]]:
    tags = [str(value) for value in question.get("tags", []) if value]
    terms: list[str] = [str(value) for value in question.get("primary_term_names", []) if value]
    for term in question.get("primary_terms", []):
        if not isinstance(term, dict):
            continue
        terms.extend(str(term.get(key)) for key in ("term", "category", "code") if term.get(key))
    return tags, terms


def app_candidates(question: dict) -> list[str]:
    tags, terms = searchable_parts(question)
    search_text = " ".join(tags + terms)
    return [field_id for field_id, needles in APP_NEEDLES.items() if any(needle in search_text for needle in needles)]


def automatic_primary(question: dict, candidates: list[str]) -> tuple[str, dict[str, int], list[str]]:
    tags, terms = searchable_parts(question)
    scores = {field_id: 0 for field_id in candidates}
    matches: list[str] = []

    for field_id in candidates:
        if tags and tags[0] in DOMAIN_TAGS[field_id]:
            scores[field_id] += 500
            matches.append(f"先頭タグ:{tags[0]}")
        for index, tag in enumerate(tags):
            if tag in DOMAIN_TAGS[field_id]:
                scores[field_id] += 220 - min(index, 20) * 5
            for needle in APP_NEEDLES[field_id]:
                if needle in tag:
                    scores[field_id] += 90 - min(index, 20) * 2
                    if tag == needle:
                        scores[field_id] += 30
                    break
        for term in terms:
            if term in DOMAIN_TAGS[field_id]:
                scores[field_id] += 80
            if any(needle in term for needle in APP_NEEDLES[field_id]):
                scores[field_id] += 20

    primary = max(candidates, key=lambda field_id: scores[field_id])
    return primary, scores, matches


def manual_assignments() -> dict[str, tuple[str, str]]:
    assignments: dict[str, tuple[str, str]] = {}
    for field_id, group in MANUAL_REVIEW_GROUPS.items():
        for question_id in group["ids"]:
            if question_id in assignments:
                raise ValueError(f"Duplicate manual assignment: {question_id}")
            assignments[question_id] = (field_id, str(group["reason"]))
    return assignments


def classify(questions: list[dict]) -> list[dict]:
    manual = manual_assignments()
    records: list[dict] = []
    question_ids = {str(question.get("id", "")) for question in questions}
    unknown_manual_ids = sorted(set(manual) - question_ids)
    if unknown_manual_ids:
        raise ValueError(f"Manual review contains unknown IDs: {unknown_manual_ids}")

    for question in questions:
        question_id = str(question.get("id", ""))
        candidates = app_candidates(question)
        if question_id in manual:
            field_id, reason = manual[question_id]
            if candidates:
                raise ValueError(f"Manual-review question now has automatic candidates: {question_id}: {candidates}")
            scores: dict[str, int] = {}
            mode = "manual_review"
        else:
            if not candidates:
                raise ValueError(f"Unreviewed question has no field candidate: {question_id}")
            field_id, scores, _ = automatic_primary(question, candidates)
            reason = "既存の分野キーワード候補から、タグ順と一致の強さで主分野を選択"
            mode = "automatic_candidate"

        records.append(
            {
                "question_id": question_id,
                "field_id": field_id,
                "field_label": FIELD_LABELS[field_id],
                "selection": mode,
                "candidates": candidates,
                "scores": scores,
                "reason": reason,
                "tags": question.get("tags", []),
                "stem": question.get("stem", ""),
            }
        )
    return records


def validate_field_ids(questions: list[dict]) -> list[str]:
    errors: list[str] = []
    for index, question in enumerate(questions):
        question_id = str(question.get("id") or f"index:{index}")
        field_ids = question.get("field_ids")
        if not isinstance(field_ids, list) or len(field_ids) != 1:
            errors.append(f"{question_id}: field_ids must contain exactly one value")
            continue
        if field_ids[0] not in FIELD_LABELS:
            errors.append(f"{question_id}: unknown field_id: {field_ids[0]}")
    return errors


def write_reports(records: list[dict]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    candidate_path = REPORT_DIR / "field-classification.json"
    candidate_path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    manual_records = [record for record in records if record["selection"] == "manual_review"]
    counts = Counter(record["field_id"] for record in records)
    lines = [
        "# 分野分類レビュー記録",
        "",
        "生成元: `scripts/classify_questions.py`",
        "",
        "## 集計",
        "",
        f"- 全問題: {len(records)}問",
        f"- 自動候補から決定: {len(records) - len(manual_records)}問",
        f"- 候補なしを個別確認: {len(manual_records)}問",
        "- 未分類: 0問",
        "",
    ]
    for field_id, label in FIELD_LABELS.items():
        lines.append(f"- {label}: {counts[field_id]}問")
    lines.extend(
        [
            "",
            "## 候補なし69問の確認結果",
            "",
            "| 問題ID | 主分野 | 判断理由 | タグ |",
            "|---|---|---|---|",
        ]
    )
    for record in manual_records:
        tags = " / ".join(record["tags"])
        lines.append(f"| `{record['question_id']}` | {record['field_label']} | {record['reason']} | {tags} |")
    lines.extend(
        [
            "",
            "## 運用ルール",
            "",
            "- `field_ids` は主分野を表す1要素の配列とする。",
            "- 値は6分野のIDだけを許可する。",
            "- 新規問題は分類後に検証を通し、未分類のまま公開しない。",
            "- 自動候補の詳細・採点値は `docs/reports/field-classification.json` に保存する。",
            "",
        ]
    )
    (REPORT_DIR / "field-classification-review.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify every question into one primary field.")
    parser.add_argument("--apply", action="store_true", help="Write field_ids into completed_questions.json")
    parser.add_argument("--check", action="store_true", help="Validate existing field_ids against the classification")
    args = parser.parse_args()

    questions = load_questions()
    records = classify(questions)
    record_by_id = {record["question_id"]: record for record in records}

    if args.apply:
        for question in questions:
            question["field_ids"] = [record_by_id[str(question["id"])]["field_id"]]
        QUESTION_PATH.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.apply or args.check:
        errors = validate_field_ids(questions)
        for question in questions:
            expected = record_by_id[str(question["id"])]["field_id"]
            if question.get("field_ids") != [expected]:
                errors.append(f"{question['id']}: expected field_ids [{expected!r}]")
        if errors:
            raise SystemExit("\n".join(errors))

    write_reports(records)
    manual_count = sum(record["selection"] == "manual_review" for record in records)
    print(f"classified={len(records)} automatic={len(records) - manual_count} manual={manual_count}")
    print(" ".join(f"{field_id}={count}" for field_id, count in Counter(r["field_id"] for r in records).items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
