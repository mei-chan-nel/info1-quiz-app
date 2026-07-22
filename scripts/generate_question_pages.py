from __future__ import annotations

import hashlib
import html
import json
import math
import shutil
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import quote

from classify_questions import validate_field_ids
from tag_normalization import CANONICAL_TAGS, TAG_ALIASES, normalize_tags


ROOT = Path(__file__).resolve().parents[1]
QUESTION_PATH = ROOT / "data" / "questions" / "completed_questions.json"
QUESTIONS_DIR = ROOT / "questions"
REPORT_DIR = ROOT / "docs" / "reports"
SITE_URL = "https://mei-chan-nel.github.io/info1-quiz-app/"
PORTAL_URL = "https://mei-chan-nel.github.io/"
ADSENSE_CLIENT = "ca-pub-6257644709224446"
PAGE_SIZE = 10
MIN_PUBLIC_TAG_QUESTIONS = 4
REVIEW_DATE = date.today()
PROTECTED_APP_FILES = (
    "app/index.html",
    "app/app.js",
    "app/startup.js",
    "app/styles.css",
    "app/issue-report.js",
    "app/issue-report.css",
    "app/learning-record.js",
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


def load_questions() -> list[dict]:
    with QUESTION_PATH.open(encoding="utf-8") as file:
        questions = json.load(file)
    errors = validate_field_ids(questions)
    if errors:
        raise ValueError("Invalid question fields:\n" + "\n".join(errors))
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


def page_filename(field: dict, page_number: int) -> str:
    suffix = "" if page_number == 1 else f"-{page_number}"
    return f"{field['slug']}{suffix}.html"


def canonical(path: str) -> str:
    return SITE_URL + path.lstrip("/")


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
        )
    canonical_url = canonical(path)
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <meta name="theme-color" content="#102f35" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="情報Ⅰ Study Atlas" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:url" content="{esc(canonical_url)}" />
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href="{esc(canonical_url)}" />
    <link rel="icon" href="{prefix}../assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="{prefix}../assets/site.css" />{ad_script}{extra_head}
  </head>"""


def header(prefix: str, current: str) -> str:
    portal_prefix = f"{prefix}../"
    nav_items = [
        ("home", f"{portal_prefix}index.html", "トップページ"),
        ("app", f"{prefix}app/", "学習アプリ"),
        ("questions", "index.html", "問題一覧"),
        ("archive", f"{portal_prefix}archive/index.html", "動画問題"),
        ("lecture", f"{portal_prefix}LectureNote/index.html", "講義ノート"),
        ("study", f"{portal_prefix}study-guide.html", "勉強法"),
        ("about", f"{portal_prefix}about.html", "このサイトについて"),
    ]
    links = []
    for key, href, label in nav_items:
        current_attr = ' aria-current="page"' if key == current else ""
        links.append(f'<a href="{href}"{current_attr}>{label}</a>')
    return f"""
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="{portal_prefix}index.html" aria-label="情報Ⅰ Study Atlas トップ">
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
        <a class="brand footer-brand" href="{portal_prefix}index.html" aria-label="情報Ⅰ Study Atlas トップ"><span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span></a>
        <nav aria-label="フッターナビゲーション">
          <a href="{portal_prefix}index.html">トップページ</a>
          <a href="{prefix}app/">学習アプリ</a>
          <a href="index.html">問題一覧</a>
          <a href="{portal_prefix}archive/index.html">動画問題</a>
          <a href="{portal_prefix}LectureNote/index.html">講義ノート</a>
          <a href="{portal_prefix}study-guide.html">勉強法</a>
          <a href="{portal_prefix}books/index.html">書籍案内</a>
          <a href="{portal_prefix}about.html">このサイトについて</a>
          <a href="{portal_prefix}privacy.html">プライバシーポリシー</a>
          <a href="{portal_prefix}sitemap.html">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>
    </footer>
    <script src="{portal_prefix}assets/site-header.js"></script>
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


def tag_filter_href(tag: str, question_id: str | None = None) -> str:
    href = f"tags.html?tag={quote(tag, safe='')}"
    if question_id:
        href += f"&question={quote(question_id, safe='')}#filter-results-heading"
    return href


def facet_links(counts: Counter[str], parameter: str) -> str:
    links = []
    for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0].casefold(), item[0])):
        href = f"tags.html?{parameter}={quote(value, safe='')}"
        links.append(
            f'<a class="facet-link" href="{href}" data-facet-value="{esc(value)}">'
            f'<span>{esc(value)}</span><small>{count}問</small></a>'
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
    searchable: bool = False,
    groups: list[tuple[str, Counter[str]]] | None = None,
) -> str:
    open_attr = " open" if open_panel else ""
    search = ""
    if searchable:
        search = (
            '<div class="facet-tools"><label class="facet-search"><span>タグ名を検索</span>'
            '<input type="search" data-facet-search autocomplete="off" placeholder="例：2進数、著作権、DNS" />'
            '</label><a class="facet-clear" href="tags.html" data-facet-clear>選択を解除</a></div>'
        )
    search_markup = f"          {search}\n" if search else ""
    if groups:
        facet_markup = "".join(
            f'''<details class="facet-group" data-facet-group{(" open" if index == 0 else "")}>
            <summary>{esc(label)} <span>{len(group_counts)}種類</span></summary>
            <div class="facet-links" data-facet-list>{facet_links(group_counts, "tag")}</div>
          </details>'''
            for index, (label, group_counts) in enumerate(groups)
            if group_counts
        )
    else:
        facet_markup = f'<div class="facet-links" data-facet-list>{facet_links(counts, "tag")}</div>'
    return f"""<details class="facet-panel"{open_attr}>
        <summary>タグ一覧から問題を絞り込む <span>{len(counts)}種類・複数選択はOR検索</span></summary>
        <div class="facet-panel-body">
          <p>タグは主に関連する分野へ整理しています。この一覧では複数選択のOR検索、各問題に付くタグからはそのタグだけの検索になります。</p>
{search_markup}          <div class="facet-groups" data-facet-groups>{facet_markup}</div>
        </div>
      </details>"""


def field_card(field: dict, count: int, href: str) -> str:
    topics = "".join(f"<li>{esc(topic)}</li>" for topic in field["topics"])
    return f"""
          <article class="field-card accent-{field['accent']}">
            <div class="field-card-head"><span>{field['number']}</span><p>{count}問</p></div>
            <h3>{esc(field['label'])}</h3>
            <p>{esc(field['summary'])}</p>
            <ul class="topic-list">{topics}</ul>
            <a class="text-link" href="{href}">{esc(field['label'])}の問題を読む <span aria-hidden="true">→</span></a>
          </article>"""




def render_questions_index(grouped: dict[str, list[dict]], public_tags: set[str]) -> None:
    total = sum(len(items) for items in grouped.values())
    tag_counts = Counter(
        str(tag).strip()
        for questions in grouped.values()
        for question in questions
        for tag in question.get("tags", [])
        if str(tag).strip() in public_tags
    )
    cards = "".join(field_card(field, len(grouped[field["id"]]), page_filename(field, 1)) for field in FIELDS)
    title = f"情報Ⅰ共通テスト対策問題{total}問 | Study Atlas"
    description = f"高校生・受験生向けの情報Ⅰ共通テスト対策問題{total}問。検索では「情報1」とも表記される科目を6分野に整理し、正答・解説・出典と{len(tag_counts)}種類のタグを掲載しています。"
    schema = structured_data(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": description,
            "url": canonical("questions/index.html"),
            "inLanguage": "ja",
            "about": "高等学校 情報Ⅰ・大学入学共通テスト",
            "audience": {"@type": "EducationalAudience", "educationalRole": "student"},
            "isPartOf": {"@type": "WebSite", "name": "情報Ⅰ Study Atlas", "url": PORTAL_URL},
        }
    ) + structured_data(
        breadcrumb_data(
            [("学習トップ", PORTAL_URL), ("情報Ⅰの問題一覧", canonical("questions/index.html"))]
        )
    )
    body = f"""{head(title, description, 'questions/index.html', '../', ads=True)}
  <body>
    {header('../', 'questions')}
    <main id="main-content" class="subpage">
      {breadcrumb([('学習トップ', '../../index.html'), ('問題一覧', None)])}
      <section class="page-hero compact-hero">
        <p class="eyebrow">INFORMATION I · QUESTION LIBRARY</p><h1>情報Ⅰ共通テスト対策問題</h1>
        <p>高校生・受験生向けに、情報Ⅰ（「情報1」「情報I」と検索される科目）の全{total}問を主分野ごとに整理しています。正答と解説は各問の「正答と解説を確認」から開けます。</p>
      </section>
      <section class="library-notes" aria-label="一覧の使い方">
        <article><strong>6分野</strong><span>学習内容の主題で各問を1つの分野へ分類</span></article>
        <article><strong>10問</strong><span>読みやすさのため1ページの上限を設定</span></article>
        <article><strong>根拠付き</strong><span>正答・解説・出典・タグをまとめて掲載</span></article>
      </section>
      {facet_panel(tag_counts, groups=primary_tag_groups(grouped, public_tags))}
      <section class="section no-top-padding" aria-labelledby="choose-field"><div class="section-heading"><div><p class="eyebrow">CHOOSE A FIELD</p><h2 id="choose-field">分野を選ぶ</h2></div></div><div class="field-grid">{cards}</div></section>
      <aside class="content-note"><h2>掲載内容について</h2><p>問題は共通テスト「情報Ⅰ」の学習用として作成・改題したものです。公式の問題・解答・解説ではありません。出典表示は各問題に記載しています。勉強の進め方は<a href="../../study-guide.html">情報Ⅰの勉強法</a>、誤りや範囲については<a href="../../about.html#contact">お問い合わせ先</a>をご確認ください。</p></aside>
      {schema}
    </main>
    {footer('../')}"""
    (QUESTIONS_DIR / "index.html").write_text(body, encoding="utf-8")


def answer_choice(question: dict) -> dict | None:
    answer_id = str(question.get("answer_choice_id", ""))
    for choice in question.get("choices", []):
        if str(choice.get("choice_id", "")) == answer_id:
            return choice
    for choice in question.get("choices", []):
        if choice.get("is_correct") or str(choice.get("label", "")) == str(question.get("correct_choice", "")):
            return choice
    return None


def source_label(question: dict) -> str:
    source = str(question.get("source_display", "")).strip() or "独自作成"
    if question.get("改題") is True and "改題" not in source:
        source += "（改題）"
    return source


def render_question(question: dict, number: int, public_tags: set[str]) -> str:
    choices = "".join(
        f'<li><span>{esc(choice.get("label", ""))}</span><p>{esc(choice.get("text", ""))}</p></li>'
        for choice in question.get("choices", [])
    )
    correct = answer_choice(question)
    if not correct:
        raise ValueError(f"{question['id']}: correct choice not found")
    source = source_label(question)
    tags = "".join(
        f'<li><a class="tag-link" href="{tag_filter_href(str(tag), str(question["id"]))}">{esc(tag)}</a></li>'
        for tag in question.get("tags", [])
        if str(tag).strip() in public_tags
    )
    tag_row = f'\n              <div class="tag-row"><span>タグ</span><ul>{tags}</ul></div>' if tags else ""
    explanation = str(question.get("explanation", "")).strip()
    return f"""
        <article class="question-card" id="q-{esc(question['id'])}">
          <div class="question-meta"><span>QUESTION {number:03d}</span><a href="#q-{esc(question['id'])}" aria-label="この問題へのリンク">#{esc(question['id'])}</a></div>
          <h2>{esc(question.get('stem', ''))}</h2>
          <ol class="choice-list">{choices}</ol>
          <details class="answer-panel">
            <summary><span>正答と解説を確認</span><span class="detail-icon" aria-hidden="true"></span></summary>
            <div class="answer-content">
              <p class="correct-answer"><span>正答</span><strong>{esc(correct.get('label', ''))}. {esc(correct.get('text', ''))}</strong></p>
              <div class="explanation"><h3>解説</h3><p>{esc(explanation)}</p></div>
              <dl class="source-row"><dt>出典</dt><dd>{esc(source)}</dd></dl>{tag_row}
            </div>
          </details>
        </article>"""


def pagination(field: dict, current: int, total_pages: int, *, top: bool = False) -> str:
    links: list[str] = []
    if current > 1:
        links.append(f'<a class="page-direction" href="{page_filename(field, current - 1)}" rel="prev">← 前へ</a>')
    else:
        links.append('<span class="page-direction disabled">← 前へ</span>')
    visible_numbers = sorted({1, total_pages, *range(max(1, current - 2), min(total_pages, current + 2) + 1)})
    numbered = []
    previous_number = 0
    for number in visible_numbers:
        if previous_number and number - previous_number > 1:
            numbered.append('<span class="page-ellipsis" aria-hidden="true">…</span>')
        if number == current:
            numbered.append(f'<span aria-current="page">{number}</span>')
        else:
            numbered.append(f'<a href="{page_filename(field, number)}" aria-label="{number}ページ目">{number}</a>')
        previous_number = number
    links.append('<span class="page-numbers">' + "".join(numbered) + "</span>")
    if current < total_pages:
        links.append(f'<a class="page-direction" href="{page_filename(field, current + 1)}" rel="next">次へ →</a>')
    else:
        links.append('<span class="page-direction disabled">次へ →</span>')
    extra = " pagination-top" if top else ""
    return f'<nav class="pagination{extra}" aria-label="{esc(field["label"])}のページ移動">' + "".join(links) + "</nav>"


def render_field_pages(field: dict, questions: list[dict], public_tags: set[str]) -> list[str]:
    paths: list[str] = []
    total_pages = math.ceil(len(questions) / PAGE_SIZE)
    tag_counts = Counter(
        str(tag).strip()
        for question in questions
        for tag in question.get("tags", [])
        if str(tag).strip() in public_tags
    )
    for page_number in range(1, total_pages + 1):
        filename = page_filename(field, page_number)
        path = f"questions/{filename}"
        paths.append(path)
        page_questions = questions[(page_number - 1) * PAGE_SIZE : page_number * PAGE_SIZE]
        start_number = (page_number - 1) * PAGE_SIZE + 1
        end_number = start_number + len(page_questions) - 1
        cards = "".join(
            render_question(question, index, public_tags)
            for index, question in enumerate(page_questions, start=start_number)
        )
        page_suffix = f"（{page_number}/{total_pages}ページ）" if total_pages > 1 else ""
        title = f"情報Ⅰ {field['label']}の問題 {page_suffix} | 共通テスト対策"
        description = f"高校生・受験生向けの情報Ⅰ共通テスト対策。「{field['label']}」の問題{start_number}〜{end_number}を、正答・解説・出典と、該当する場合は関連タグも付けて掲載しています。"
        page_url = canonical(path)
        schema = structured_data(
            {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": title,
                "description": description,
                "url": page_url,
                "inLanguage": "ja",
                "about": ["情報Ⅰ", "大学入学共通テスト", field["label"]],
                "audience": {"@type": "EducationalAudience", "educationalRole": "student"},
                "isPartOf": {"@type": "WebSite", "name": "情報Ⅰ Study Atlas", "url": PORTAL_URL},
                "mainEntity": {
                    "@type": "ItemList",
                    "numberOfItems": len(page_questions),
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": index,
                            "url": f"{page_url}#q-{question['id']}",
                            "name": str(question.get("stem", "")),
                        }
                        for index, question in enumerate(page_questions, start=1)
                    ],
                },
            }
        ) + structured_data(
            breadcrumb_data(
                [
                    ("学習トップ", PORTAL_URL),
                    ("情報Ⅰの問題一覧", canonical("questions/index.html")),
                    (field["label"], page_url),
                ]
            )
        )
        body = f"""{head(title, description, path, '../', ads=True)}
  <body>
    {header('../', 'questions')}
    <main id="main-content" class="subpage question-page">
      {breadcrumb([('学習トップ', '../../index.html'), ('問題一覧', 'index.html'), (field['label'], None)])}
      <section class="field-hero accent-{field['accent']}">
        <div><p class="eyebrow">FIELD {field['number']}</p><h1>{esc(field['label'])}</h1><p>{esc(field['intro'])}</p></div>
        <dl><div><dt>掲載数</dt><dd>{len(questions)}問</dd></div><div><dt>このページ</dt><dd>{start_number}–{end_number}問</dd></div></dl>
      </section>
      {facet_panel(tag_counts)}
      {pagination(field, page_number, total_pages, top=True)}
      <section class="question-list" aria-label="{esc(field['label'])}の問題">{cards}</section>
      {pagination(field, page_number, total_pages)}
      <aside class="next-action"><div><p class="eyebrow">PRACTICE</p><h2>読んだ知識をランダム出題で確認</h2><p>学習アプリでは「{esc(field['label'])}」を選んで、1〜50問に挑戦できます。</p></div><a class="button button-primary" href="../app/">学習アプリを開く</a></aside>
      {schema}
    </main>
    {footer('../')}"""
        (QUESTIONS_DIR / filename).write_text(body, encoding="utf-8")
    return paths


def build_filter_payload(grouped: dict[str, list[dict]], public_tags: set[str]) -> dict:
    items: list[dict] = []
    global_number = 0
    for field in FIELDS:
        field_questions = grouped[field["id"]]
        for field_number, question in enumerate(field_questions, start=1):
            global_number += 1
            page_number = math.ceil(field_number / PAGE_SIZE)
            correct = answer_choice(question)
            if not correct:
                raise ValueError(f"{question['id']}: correct choice not found")
            items.append(
                {
                    "id": str(question["id"]),
                    "number": global_number,
                    "field_number": field_number,
                    "field_id": field["id"],
                    "field_label": field["label"],
                    "stem": str(question.get("stem", "")),
                    "choices": [
                        {"label": str(choice.get("label", "")), "text": str(choice.get("text", ""))}
                        for choice in question.get("choices", [])
                    ],
                    "correct": {"label": str(correct.get("label", "")), "text": str(correct.get("text", ""))},
                    "explanation": str(question.get("explanation", "")).strip(),
                    "source": source_label(question),
                    "tags": [
                        str(tag).strip()
                        for tag in question.get("tags", [])
                        if str(tag).strip() in public_tags
                    ],
                    "source_href": f"{page_filename(field, page_number)}#q-{question['id']}",
                }
            )
    tag_counts = Counter(tag for item in items for tag in item["tags"])
    return {
        "generated_on": REVIEW_DATE.isoformat(),
        "question_count": len(items),
        "tag_count": len(tag_counts),
        "match_mode": "OR",
        "tag_aliases": TAG_ALIASES,
        "questions": items,
    }


def render_filter_question(question: dict) -> str:
    choices = "".join(
        f'<li><span>{esc(choice["label"])}</span><p>{esc(choice["text"])}</p></li>'
        for choice in question["choices"]
    )
    tag_links = "".join(
        f'<li><a class="tag-link" href="{tag_filter_href(tag, str(question["id"]))}">{esc(tag)}</a></li>'
        for tag in question["tags"]
    )
    tag_row = (
        f'              <div class="tag-row"><span>タグ</span><ul>{tag_links}</ul></div>'
        if tag_links
        else ""
    )
    tags_json = json.dumps(question["tags"], ensure_ascii=False, separators=(",", ":"))
    return f"""        <article class="question-card filtered-question-card" id="filtered-q-{esc(question['id'])}" data-filter-question data-question-id="{esc(question['id'])}" data-filter-tags="{esc(tags_json)}">
          <div class="question-meta"><span>{esc(question['field_label'])} · QUESTION {int(question['field_number']):03d}</span><a href="{esc(question['source_href'])}">通常ページで開く</a></div>
          <h2>{esc(question['stem'])}</h2>
          <ol class="choice-list">{choices}</ol>
          <details class="answer-panel">
            <summary><span>正答と解説を確認</span><span class="detail-icon" aria-hidden="true"></span></summary>
            <div class="answer-content">
              <p class="correct-answer"><span>正答</span><strong>{esc(question['correct']['label'])}. {esc(question['correct']['text'])}</strong></p>
              <div class="explanation"><h3>解説</h3><p>{esc(question['explanation'])}</p></div>
              <dl class="source-row"><dt>出典</dt><dd>{esc(question['source'])}</dd></dl>
{tag_row}
            </div>
          </details>
        </article>"""


def render_tag_filter_page(payload: dict) -> None:
    tag_counts = Counter(tag for question in payload["questions"] for tag in question["tags"])
    grouped = {
        field["id"]: [question for question in payload["questions"] if question["field_id"] == field["id"]]
        for field in FIELDS
    }
    title = "情報Ⅰ（情報1）の問題をタグから探す | 共通テスト対策"
    description = f"情報Ⅰの問題{payload['question_count']}問を{payload['tag_count']}種類のタグから検索。複数タグはOR条件で抽出し、正答・解説・出典まで確認できます。"
    schema = structured_data(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": description,
            "url": canonical("questions/tags.html"),
            "inLanguage": "ja",
            "about": ["情報Ⅰ", "大学入学共通テスト", "問題検索"],
            "audience": {"@type": "EducationalAudience", "educationalRole": "student"},
        }
    ) + structured_data(
        breadcrumb_data(
            [
                ("学習トップ", PORTAL_URL),
                ("情報Ⅰの問題一覧", canonical("questions/index.html")),
                ("タグから探す", canonical("questions/tags.html")),
            ]
        )
    )
    extra_head = '\n    <script src="../assets/question-filter.js" defer></script>'
    filter_cards = "\n".join(render_filter_question(question) for question in payload["questions"])
    aliases_json = json.dumps(payload["tag_aliases"], ensure_ascii=False, separators=(",", ":"))
    body = f"""{head(title, description, 'questions/tags.html', '../', ads=True, extra_head=extra_head)}
  <body>
    {header('../', 'questions')}
    <main id="main-content" class="subpage filter-page" data-question-filter data-filter-data="filter-data.json" data-filter-param="tag" data-tag-aliases="{esc(aliases_json)}">
      {breadcrumb([('学習トップ', '../../index.html'), ('問題一覧', 'index.html'), ('タグから探す', None)])}
      <section class="page-hero compact-hero">
        <p class="eyebrow">TAG SEARCH · OR FILTER</p>
        <h1>タグから問題を探す</h1>
        <p>調べたいタグを選ぶと、そのタグを含む情報Ⅰの問題を抽出します。複数選択した場合は、いずれか1つ以上を含む問題を表示します。</p>
      </section>
      {facet_panel(tag_counts, open_panel=True, searchable=True, groups=primary_tag_groups(grouped, set(tag_counts)))}
      <section class="filter-results" aria-labelledby="filter-results-heading">
        <div class="filter-results-heading"><p class="eyebrow">FILTERED QUESTIONS</p><h2 id="filter-results-heading" data-filter-heading>タグを選択してください</h2><p data-filter-summary>{payload['question_count']}問からOR条件で抽出します。</p></div>
        <noscript><p class="filter-message">JavaScriptが無効なため、全{payload['question_count']}問を表示しています。</p></noscript>
        <div class="filter-result-list" id="filter-result-list" data-filter-results>
          <p class="filter-message" data-filter-message hidden></p>
{filter_cards}
        </div>
        <div class="filter-load-more-controls" data-filter-controls hidden>
          <p class="filter-result-status" data-filter-live aria-live="polite" aria-atomic="true"></p>
          <button class="button button-ghost filter-load-more-button" type="button" data-filter-load-more aria-controls="filter-result-list"></button>
        </div>
      </section>
      {schema}
    </main>
    {footer('../')}"""
    (QUESTIONS_DIR / "tags.html").write_text(body, encoding="utf-8")
    (QUESTIONS_DIR / "filter-data.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
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
    grouped: dict[str, list[dict]], generated_paths: list[str], public_tags: set[str]
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
        "page_size": PAGE_SIZE,
        "field_counts": {field["id"]: len(grouped[field["id"]]) for field in FIELDS},
        "raw_tag_count": len(tag_counts),
        "tag_count": len(public_tags),
        "minimum_public_tag_questions": MIN_PUBLIC_TAG_QUESTIONS,
        "forced_public_tags": sorted(
            tag for tag in CANONICAL_TAGS if tag_counts[tag] and tag_counts[tag] < MIN_PUBLIC_TAG_QUESTIONS
        ),
        "tag_aliases": TAG_ALIASES,
        "hidden_low_frequency_tag_count": len(tag_counts) - len(public_tags),
        "questions_without_public_tags": sum(
            not any(str(tag).strip() in public_tags for tag in question.get("tags", []))
            for items in grouped.values()
            for question in items
        ),
        "tag_filter_page": "questions/tags.html",
        "tag_filter_data": "questions/filter-data.json",
        "filter_match_mode": "OR",
        "learning_pages": ["questions/index.html", *generated_paths],
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
        tag for tag, count in tag_counts.items() if count >= MIN_PUBLIC_TAG_QUESTIONS
    }
    public_tags.update(tag for tag in CANONICAL_TAGS if tag_counts[tag])

    if QUESTIONS_DIR.resolve().parent != ROOT.resolve():
        raise RuntimeError("Refusing to regenerate questions outside the repository root")
    if QUESTIONS_DIR.exists():
        shutil.rmtree(QUESTIONS_DIR)
    QUESTIONS_DIR.mkdir(parents=True)

    render_questions_index(grouped, public_tags)
    generated_paths: list[str] = []
    for field in FIELDS:
        generated_paths.extend(render_field_pages(field, grouped[field["id"]], public_tags))
    filter_payload = build_filter_payload(grouped, public_tags)
    render_tag_filter_page(filter_payload)
    generated_paths.append("questions/tags.html")
    write_build_report(grouped, generated_paths, public_tags)
    print(f"questions={len(questions)} field_pages={len(generated_paths)} question_library_pages={len(generated_paths) + 1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
