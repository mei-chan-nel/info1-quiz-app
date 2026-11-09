from __future__ import annotations

import hashlib
import html
import json
import shutil
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlencode

from classify_questions import validate_question_data
from tag_normalization import CANONICAL_TAGS, EXCLUDED_PUBLIC_TAGS, TAG_ALIASES, normalize_tag, normalize_tags


ROOT = Path(__file__).resolve().parents[1]
QUESTION_PATH = ROOT / "data" / "questions" / "completed_questions.json"
TAG_DESCRIPTIONS_PATH = ROOT / "data" / "tags" / "tag_descriptions.json"
QUESTIONS_DIR = ROOT / "questions"
REPORT_DIR = ROOT / "docs" / "reports"
SITE_URL = "https://mei-chan-nel.com/info1-quiz-app/"
PORTAL_URL = "https://mei-chan-nel.com/"
SEARCH_ASSET_VERSION = "2026110903"
OG_IMAGE_URL = "https://mei-chan-nel.com/assets/og/study-atlas-home-og.png"
OG_IMAGE_ALT = "情報Ⅰ Study Atlasの学習マップと「知識を、ひろげ、つなげる」のメッセージ"
OG_IMAGE_WIDTH = 1734
OG_IMAGE_HEIGHT = 907
ADSENSE_CLIENT = "ca-pub-6257644709224446"
MIN_PUBLIC_TAG_QUESTIONS = 1
REVIEW_DATE = date.today()
PROTECTED_APP_FILES = (
    "app/index.html",
    "app/app.js",
    "app/question-data.js",
    "app/question-selection.js",
    "app/similar-questions.js",
    "app/startup.js",
    "app/styles.css",
    "app/issue-report.js",
    "app/issue-report.css",
    "app/learning-record.js",
    "app/tag-challenge.js",
)

FIELDS = [
    {
        "id": "society_security",
        "slug": "society-security",
        "label": "社会・セキュリティ",
        "number": "01",
        "summary": "情報社会の権利・責任と、安全に情報を扱うための仕組みを学びます。",
        "intro": "著作権や個人情報、情報モラル、認証、暗号、マルウェア対策などを扱います。用語だけでなく、場面に応じて何を守るのかを考えることが大切です。",
        "topics": ["情報社会", "著作権・個人情報", "認証・暗号", "セキュリティ対策"],
        "accent": "coral",
    },
    {
        "id": "digital",
        "slug": "digital-expression",
        "label": "デジタル表現",
        "number": "02",
        "summary": "数値・文字・画像・音を、コンピュータが扱う形にする方法を学びます。",
        "intro": "2進数、データ量、文字コード、画像・音声のデジタル化、論理演算、コンピュータの構成などを扱います。単位と計算条件を丁寧に読むのがコツです。",
        "topics": ["2進数とデータ量", "文字・画像・音声", "論理演算", "コンピュータ構成"],
        "accent": "amber",
    },
    {
        "id": "network",
        "slug": "network",
        "label": "ネットワーク",
        "number": "03",
        "summary": "端末同士が情報を届け合うための規則と機器の役割を学びます。",
        "intro": "IPアドレス、DNS、TCP/IP、LAN、電子メール、Webの仕組みなどを扱います。送信元から宛先までの流れを図のように思い浮かべると整理できます。",
        "topics": ["TCP/IP", "IPアドレス・DNS", "LANと通信機器", "Web・電子メール"],
        "accent": "blue",
    },
    {
        "id": "data_db",
        "slug": "data-database",
        "label": "データ活用・DB",
        "number": "04",
        "summary": "データを集め、整え、比較し、意味のある情報へ変える方法を学びます。",
        "intro": "代表値、散布図、相関、データの尺度、表計算、リレーショナルデータベースなどを扱います。数値が示す事実と、そこからの解釈を区別しましょう。",
        "topics": ["統計とグラフ", "データの尺度", "表計算", "データベース"],
        "accent": "mint",
    },
    {
        "id": "algorithm",
        "slug": "algorithm",
        "label": "アルゴリズム",
        "number": "05",
        "summary": "問題を手順へ分解し、コンピュータで処理する考え方を学びます。",
        "intro": "変数、配列、条件分岐、繰返し、探索、シミュレーション、プログラムの読解などを扱います。値がどの順番で変わるかを追うことが基本です。",
        "topics": ["変数・配列", "分岐・繰返し", "探索", "モデル化・制御"],
        "accent": "violet",
    },
    {
        "id": "design",
        "slug": "information-design",
        "label": "情報デザイン",
        "number": "06",
        "summary": "伝える相手と目的に合わせ、情報を分かりやすく設計する方法を学びます。",
        "intro": "アクセシビリティ、ユーザインタフェース、ピクトグラム、Web表現、グラフの見せ方などを扱います。見た目だけでなく、迷わず正確に伝わるかを考えます。",
        "topics": ["アクセシビリティ", "UI・操作性", "視覚表現", "Webデザイン"],
        "accent": "pink",
    },
]

def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_tag_descriptions() -> dict[str, str]:
    duplicate_keys: list[str] = []

    def capture_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
        values: dict[str, object] = {}
        for key, value in pairs:
            if key in values:
                duplicate_keys.append(str(key))
            values[key] = value
        return values

    try:
        raw = json.loads(
            TAG_DESCRIPTIONS_PATH.read_text(encoding="utf-8"),
            object_pairs_hook=capture_pairs,
        )
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not load {TAG_DESCRIPTIONS_PATH.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(raw, dict):
        raise ValueError(f"{TAG_DESCRIPTIONS_PATH.relative_to(ROOT)} must contain a JSON object")

    descriptions: dict[str, str] = {}
    blank_tags: list[str] = []
    blank_descriptions: list[str] = []
    non_normalized_tags: list[str] = []
    duplicate_normalized_tags = set(duplicate_keys)
    for raw_tag, raw_description in raw.items():
        tag = str(raw_tag).strip()
        normalized_tag = normalize_tag(tag)
        description = raw_description.strip() if isinstance(raw_description, str) else ""
        if not tag:
            blank_tags.append(str(raw_tag))
        if not description:
            blank_descriptions.append(tag or str(raw_tag))
        if tag and tag != normalized_tag:
            non_normalized_tags.append(f"{tag} -> {normalized_tag}")
        if normalized_tag in descriptions:
            duplicate_normalized_tags.add(normalized_tag)
        if tag and description:
            descriptions[normalized_tag] = description

    if blank_tags or blank_descriptions or non_normalized_tags or duplicate_normalized_tags:
        raise ValueError(
            "Invalid tag description data: "
            f"blank_tags={blank_tags}, "
            f"blank_descriptions={blank_descriptions}, "
            f"non_normalized_tags={non_normalized_tags}, "
            f"duplicate_normalized_tags={sorted(duplicate_normalized_tags)}"
        )
    return descriptions


def load_questions() -> list[dict]:
    with QUESTION_PATH.open(encoding="utf-8") as file:
        questions = json.load(file)
    errors = validate_question_data(questions)
    if errors:
        raise ValueError("Invalid question data:\n" + "\n".join(errors))
    seen: set[str] = set()
    for question in questions:
        question_id = str(question.get("id", ""))
        if not question_id or question_id in seen:
            raise ValueError(f"Missing or duplicate question id: {question_id!r}")
        seen.add(question_id)
        choices = question.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            raise ValueError(f"{question_id}: at least two choices are required")
        if not question.get("answer_choice_id"):
            raise ValueError(f"{question_id}: answer_choice_id is required")
        question["tags"] = normalize_tags(question.get("tags", []))
    return questions


def canonical(path: str) -> str:
    relative = path.lstrip("/")
    if relative == "questions/index.html":
        relative = "questions/"
    return SITE_URL + relative


def head(
    title: str,
    description: str,
    path: str,
    prefix: str,
    *,
    ads: bool,
    extra_head: str = "",
) -> str:
    ad_script = ""
    if ads:
        ad_script = (
            f'\n    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" '
            'crossorigin="anonymous"></script>'
            f'\n    <script src="{prefix}../assets/manual-ads.js?v=2026080901" defer></script>'
        )
    canonical_url = canonical(path)
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="{prefix}../assets/site-analytics.js?v=2026101201" defer></script>
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <meta name="theme-color" content="#102f35" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="情報Ⅰ Study Atlas" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:url" content="{esc(canonical_url)}" />
    <meta property="og:image" content="{OG_IMAGE_URL}" />
    <meta property="og:image:secure_url" content="{OG_IMAGE_URL}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="{OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="{OG_IMAGE_HEIGHT}" />
    <meta property="og:image:alt" content="{OG_IMAGE_ALT}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="{OG_IMAGE_URL}" />
    <meta name="twitter:image:alt" content="{OG_IMAGE_ALT}" />
    <link rel="canonical" href="{esc(canonical_url)}" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="{prefix}../assets/site.css?v=2026083001" />{ad_script}{extra_head}
  </head>"""


def header(prefix: str, current: str) -> str:
    portal_prefix = f"{prefix}../"
    nav_items = [
        ("home", portal_prefix, "トップページ"),
        ("app", f"{prefix}app/", "学習アプリ"),
        ("questions", "./", "問題を探す"),
        ("archive", f"{portal_prefix}archive/", "解説動画"),
        ("lecture", f"{portal_prefix}LectureNote/", "講義ノート"),
        ("trace", f"{portal_prefix}program-trace/", "プログラムトレース"),
    ]
    links = []
    for key, href, label in nav_items:
        current_attr = ' aria-current="page"' if key == current else ""
        links.append(f'<a href="{href}"{current_attr}>{label}</a>')
    return f"""
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="{portal_prefix}" aria-label="情報Ⅰ Study Atlas トップ">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">{''.join(links)}</nav>
      </div>
    </header>"""


def footer(prefix: str) -> str:
    portal_prefix = f"{prefix}../"
    return f"""
    <footer class="site-footer">
      <div class="footer-grid">
        <a class="brand footer-brand" href="{portal_prefix}" aria-label="情報Ⅰ Study Atlas トップ"><span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span></a>
        <nav aria-label="フッターナビゲーション">
          <a href="{portal_prefix}">トップページ</a>
          <a href="{prefix}app/">学習アプリ</a>
          <a href="./">問題を探す</a>
          <a href="{portal_prefix}archive/">解説動画</a>
          <a href="{portal_prefix}LectureNote/">講義ノート</a>
          <a href="{portal_prefix}program-trace/">プログラムトレース</a>
          <a href="{portal_prefix}books/">書籍案内</a>
          <a href="{portal_prefix}study-guide.html">使い方</a>
          <a href="{portal_prefix}about.html">このサイトについて</a>
          <a href="{portal_prefix}privacy.html">プライバシーポリシー</a>
          <a href="{portal_prefix}sitemap.html">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>
    </footer>
    <script src="{portal_prefix}assets/site-header.js?v=2026101201"></script>
  </body>
</html>
"""


def breadcrumb(items: list[tuple[str, str | None]]) -> str:
    parts = []
    for label, href in items:
        if href:
            parts.append(f'<a href="{href}">{esc(label)}</a>')
        else:
            parts.append(f'<span aria-current="page">{esc(label)}</span>')
    return '<nav class="breadcrumb" aria-label="パンくずリスト">' + '<span aria-hidden="true">/</span>'.join(parts) + "</nav>"


def structured_data(value: dict) -> str:
    return f'<script type="application/ld+json">{json.dumps(value, ensure_ascii=False, separators=(",", ":"))}</script>'


def breadcrumb_data(items: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": index, "name": label, "item": url}
            for index, (label, url) in enumerate(items, start=1)
        ],
    }


def facet_links(counts: Counter[str], parameter: str) -> str:
    links = []
    for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0].casefold(), item[0])):
        href = f"./#{urlencode([(parameter, value)])}"
        links.append(
            f'<a class="facet-link" href="{href}" data-facet-value="{esc(value)}">'
            f'<span>{esc(value)}</span><small data-facet-count>{count}問</small></a>'
        )
    return "".join(links)


def primary_tag_groups(
    grouped: dict[str, list[dict]], public_tags: set[str]
) -> list[tuple[str, Counter[str]]]:
    counts_by_field = {
        field["id"]: Counter(
            str(tag).strip()
            for question in grouped.get(field["id"], [])
            for tag in question.get("tags", [])
            if str(tag).strip() in public_tags
        )
        for field in FIELDS
    }
    overall = Counter(
        tag for counts in counts_by_field.values() for tag, count in counts.items() for _ in range(count)
    )
    assigned = {field["id"]: Counter() for field in FIELDS}
    for tag, total in overall.items():
        primary = max(FIELDS, key=lambda field: counts_by_field[field["id"]][tag])
        assigned[primary["id"]][tag] = total
    return [(field["label"], assigned[field["id"]]) for field in FIELDS]


def facet_panel(
    counts: Counter[str],
    *,
    open_panel: bool = False,
    with_clear: bool = False,
    groups: list[tuple[str, Counter[str]]] | None = None,
) -> str:
    open_attr = " open" if open_panel else ""
    clear_markup = (
        '          <div class="facet-tools"><a class="facet-clear" href="./" data-facet-clear>選択を解除</a></div>\n'
        if with_clear
        else ""
    )
    if groups:
        facet_markup = "".join(
            f'''<details class="facet-group" data-facet-group>
            <summary>{esc(label)} <span>{len(group_counts)}種類</span></summary>
            <div class="facet-links" data-facet-list>{facet_links(group_counts, "tag")}</div>
          </details>'''
            for index, (label, group_counts) in enumerate(groups)
            if group_counts
        )
    else:
        facet_markup = f'<div class="facet-links" data-facet-list>{facet_links(counts, "tag")}</div>'
    return f"""<details class="facet-panel"{open_attr}>
        <summary>タグ検索 <span>{len(counts)}種類・複数選択はAND検索</span></summary>
        <div class="facet-panel-body">
          <p>タグは主に関連する分野へ整理しています。複数選択すると、すべてのタグを含む問題を検索します。</p>
{clear_markup}          <div class="facet-groups" data-facet-groups>{facet_markup}</div>
        </div>
      </details>"""


def answer_choice(question: dict) -> dict | None:
    answer_id = str(question.get("answer_choice_id", ""))
    for choice in question.get("choices", []):
        if str(choice.get("choice_id", "")) == answer_id:
            return choice
    return None


def source_label(question: dict) -> str:
    source = str(question.get("source_display", "")).strip() or "独自作成"
    if question.get("改題") is True and "改題" not in source:
        source += "（改題）"
    return source


def build_filter_payload(questions: list[dict], public_tags: set[str]) -> dict:
    fields_by_id = {field["id"]: field for field in FIELDS}
    field_numbers: Counter[str] = Counter()
    items: list[dict] = []
    for global_number, question in enumerate(questions, start=1):
        field_id = question["field_ids"][0]
        field = fields_by_id[field_id]
        field_numbers[field_id] += 1
        correct = answer_choice(question)
        if not correct:
            raise ValueError(f"{question['id']}: correct choice not found")
        items.append(
            {
                "id": str(question["id"]),
                "number": global_number,
                "field_number": field_numbers[field_id],
                "field_id": field_id,
                "field_label": field["label"],
                "stem": str(question.get("stem", "")),
                "choices": [
                    {
                        "choice_id": str(choice["choice_id"]),
                        "label": str(choice.get("label", "")),
                        "text": str(choice.get("text", "")),
                        "explanation": str(choice.get("explanation", "")),
                    }
                    for choice in question.get("choices", [])
                ],
                "answer_choice_id": str(question["answer_choice_id"]),
                "correct": {"label": str(correct.get("label", "")), "text": str(correct.get("text", ""))},
                "explanation": str(question.get("explanation", "")).strip(),
                "source": source_label(question),
                "tags": [
                    str(tag).strip()
                    for tag in question.get("tags", [])
                    if str(tag).strip() in public_tags
                ],
            }
        )

    # The JSON array is the registration ledger: newly registered questions are
    # appended to it. Reverse only the rendered payload so the source remains a
    # stable chronological record while the public list stays newest-first.
    items.reverse()
    tag_counts = Counter(tag for item in items for tag in item["tags"])
    return {
        "generated_on": REVIEW_DATE.isoformat(),
        "question_count": len(items),
        "tag_count": len(tag_counts),
        "match_mode": "AND",
        "tag_aliases": TAG_ALIASES,
        "questions": items,
    }


def render_tag_filter_page(payload: dict) -> None:
    tag_counts = Counter(tag for question in payload["questions"] for tag in question["tags"])
    grouped = {
        field["id"]: [question for question in payload["questions"] if question["field_id"] == field["id"]]
        for field in FIELDS
    }
    title = "問題検索｜情報Ⅰ Study Atlas"
    description = f"情報Ⅰの問題{payload['question_count']}問をキーワードや{payload['tag_count']}種類のタグでAND検索。問題文・選択肢・全体と各選択肢の解説を検索し、正誤や解説を確認できます。"
    schema = structured_data(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": description,
            "url": canonical("questions/index.html"),
            "inLanguage": "ja",
            "about": ["情報Ⅰ", "大学入学共通テスト", "問題検索"],
            "audience": {"@type": "EducationalAudience", "educationalRole": "student"},
        }
    ) + structured_data(
        breadcrumb_data(
            [
                ("学習トップ", PORTAL_URL),
                ("問題検索", canonical("questions/index.html")),
            ]
        )
    )
    extra_head = (
        f'\n    <link rel="stylesheet" href="../assets/question-search.css?v={SEARCH_ASSET_VERSION}" />'
        f'\n    <script src="../app/tag-challenge.js?v={SEARCH_ASSET_VERSION}" defer></script>'
        f'\n    <script src="../assets/question-filter.js?v={SEARCH_ASSET_VERSION}" defer></script>'
    )
    data_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    data_version = hashlib.sha256(data_json.encode("utf-8")).hexdigest()[:16]
    (QUESTIONS_DIR / "filter-data.json").write_text(data_json, encoding="utf-8")
    aliases_json = json.dumps(payload["tag_aliases"], ensure_ascii=False, separators=(",", ":"))
    body = f"""{head(title, description, 'questions/index.html', '../', ads=True, extra_head=extra_head)}
  <body>
    {header('../', 'questions')}
    <main id="main-content" class="subpage filter-page" data-question-filter data-filter-param="tag" data-filter-data="./filter-data.json?v={data_version}" data-tag-aliases="{esc(aliases_json)}">
      {breadcrumb([('学習トップ', '../../'), ('問題検索', None)])}
      <h1 class="visually-hidden">問題検索</h1>
      <details class="facet-panel keyword-panel" data-keyword-panel open>
        <summary>キーワード検索</summary>
        <form class="facet-panel-body keyword-form" data-keyword-form role="search">
          <label for="question-keyword">キーワード（空白で区切るとAND検索）</label>
          <div class="keyword-input-row"><input id="question-keyword" type="search" data-keyword-input autocomplete="off" /><button class="button button-primary" type="submit">検索</button></div>
          <fieldset><legend>検索対象</legend><label><input type="checkbox" value="stem" data-search-field checked />問題文</label><label><input type="checkbox" value="choices" data-search-field checked />選択肢</label><label><input type="checkbox" value="explanation" data-search-field />解説</label></fieldset>
        </form>
      </details>
      <noscript><p>問題検索を利用するにはJavaScriptを有効にしてください。</p></noscript>
      {facet_panel(tag_counts, open_panel=False, with_clear=True, groups=primary_tag_groups(grouped, set(tag_counts)))}
      <section class="filter-results" aria-labelledby="filter-results-heading" hidden>
        <div class="filter-results-heading">
          <p class="eyebrow">FILTERED QUESTIONS</p>
          <div class="filter-results-title-row">
            <h2 id="filter-results-heading" data-filter-heading></h2>
            <span data-tag-challenge-controls hidden><button class="search-app-button" type="button" data-tag-challenge-start title="検索結果から最大5問をアプリで出題" disabled>アプリで出題</button></span>
          </div>
          <p data-filter-summary></p>
        </div>
        <div class="manual-ad-slot manual-ad-slot--display" data-manual-ad="display" data-ad-placement="after-tag-challenge-controls" hidden></div>
        <p class="filter-message" data-filter-message hidden></p>
        <div class="filter-result-list" id="filter-result-list" data-filter-results></div>
        <div class="filter-load-more-controls" data-filter-controls hidden>
          <p class="filter-result-status" data-filter-live aria-live="polite" aria-atomic="true"></p>
          <button class="button button-ghost filter-load-more-button" type="button" data-filter-load-more aria-controls="filter-result-list"></button>
        </div>
      </section>
      {schema}
    </main>
    {footer('../')}"""
    (QUESTIONS_DIR / "index.html").write_text(body, encoding="utf-8")


def render_legacy_tag_redirect() -> None:
    (QUESTIONS_DIR / "tags.html").write_text(
        """<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="https://mei-chan-nel.com/info1-quiz-app/questions/" />
    <meta http-equiv="refresh" content="0;url=./" />
    <title>問題を探すへ移動｜情報Ⅰ Study Atlas</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <script>
      (() => {
        const target = new URL("./", window.location.href);
        target.search = window.location.search;
        target.hash = window.location.hash;
        window.location.replace(target.href);
      })();
    </script>
  </head>
  <body><p><a href="./">問題を探すへ移動</a></p></body>
</html>
""",
        encoding="utf-8",
    )






def normalized_text_sha256(path: Path) -> str:
    content = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(content).hexdigest()


def protected_app_hashes() -> dict[str, str]:
    return {
        relative: normalized_text_sha256(ROOT / relative)
        for relative in PROTECTED_APP_FILES
    }


def write_build_report(
    grouped: dict[str, list[dict]],
    generated_paths: list[str],
    public_tags: set[str],
    tag_descriptions: dict[str, str],
    missing_tag_descriptions: list[str],
    unused_tag_descriptions: list[str],
) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    baseline_path = REPORT_DIR / "app-core-baseline-sha256.json"
    if not baseline_path.exists():
        baseline_path.write_text(json.dumps(protected_app_hashes(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tag_counts = Counter(
        str(tag).strip()
        for items in grouped.values()
        for question in items
        for tag in question.get("tags", [])
        if str(tag).strip()
    )
    report = {
        "generated_on": REVIEW_DATE.isoformat(),
        "generator": "scripts/generate_question_pages.py",
        "question_source": QUESTION_PATH.relative_to(ROOT).as_posix(),
        "question_count": sum(len(items) for items in grouped.values()),
        "field_counts": {field["id"]: len(grouped[field["id"]]) for field in FIELDS},
        "raw_tag_count": len(tag_counts),
        "tag_count": len(public_tags),
        "tag_description_source": TAG_DESCRIPTIONS_PATH.relative_to(ROOT).as_posix(),
        "tag_description_count": len(tag_descriptions),
        "missing_tag_descriptions": missing_tag_descriptions,
        "unused_tag_descriptions": unused_tag_descriptions,
        "minimum_public_tag_questions": MIN_PUBLIC_TAG_QUESTIONS,
        "forced_public_tags": sorted(
            tag for tag in CANONICAL_TAGS if tag_counts[tag] and tag_counts[tag] < MIN_PUBLIC_TAG_QUESTIONS
        ),
        "excluded_public_tags": sorted(tag for tag in EXCLUDED_PUBLIC_TAGS if tag_counts[tag]),
        "tag_aliases": TAG_ALIASES,
        "hidden_low_frequency_tag_count": sum(
            0 < count < MIN_PUBLIC_TAG_QUESTIONS
            for tag, count in tag_counts.items()
            if tag not in EXCLUDED_PUBLIC_TAGS
        ),
        "questions_without_public_tags": sum(
            not any(str(tag).strip() in public_tags for tag in question.get("tags", []))
            for items in grouped.values()
            for question in items
        ),
        "question_search_page": "questions/index.html",
        "filter_match_mode": "AND",
        "question_display_order": "newest_first",
        "learning_pages": ["questions/index.html"],
        "legacy_tag_redirect": "questions/tags.html",
        "related_app_page": "app/",
        "portal_repository": "https://github.com/mei-chan-nel/mei-chan-nel.github.io",
        "app_files_changed_by_generator": False,
    }
    (REPORT_DIR / "question-library-build.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    questions = load_questions()
    grouped: dict[str, list[dict]] = defaultdict(list)
    for question in questions:
        grouped[question["field_ids"][0]].append(question)

    tag_counts = Counter(
        str(tag).strip()
        for question in questions
        for tag in question.get("tags", [])
        if str(tag).strip()
    )
    public_tags = {
        tag
        for tag, count in tag_counts.items()
        if count >= MIN_PUBLIC_TAG_QUESTIONS and tag not in EXCLUDED_PUBLIC_TAGS
    }
    public_tags.update(
        tag for tag in CANONICAL_TAGS if tag_counts[tag] and tag not in EXCLUDED_PUBLIC_TAGS
    )
    tag_descriptions = load_tag_descriptions()
    missing_tag_descriptions = sorted(public_tags - set(tag_descriptions))
    unused_tag_descriptions = sorted(set(tag_descriptions) - public_tags)

    if QUESTIONS_DIR.resolve().parent != ROOT.resolve():
        raise RuntimeError("Refusing to regenerate questions outside the repository root")
    if QUESTIONS_DIR.exists():
        shutil.rmtree(QUESTIONS_DIR)
    QUESTIONS_DIR.mkdir(parents=True)

    filter_payload = build_filter_payload(questions, public_tags)
    render_tag_filter_page(filter_payload)
    render_legacy_tag_redirect()
    generated_paths: list[str] = []
    write_build_report(
        grouped,
        generated_paths,
        public_tags,
        tag_descriptions,
        missing_tag_descriptions,
        unused_tag_descriptions,
    )
    print(
        f"questions={len(questions)} question_search_pages=1 legacy_redirect=1 "
        f"tag_descriptions={len(tag_descriptions)} "
        f"missing_tag_descriptions={len(missing_tag_descriptions)} "
        f"unused_tag_descriptions={len(unused_tag_descriptions)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
