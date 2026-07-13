from __future__ import annotations

import hashlib
import html
import json
import math
import shutil
from collections import defaultdict
from datetime import date
from pathlib import Path

from classify_questions import validate_field_ids


ROOT = Path(__file__).resolve().parents[1]
QUESTION_PATH = ROOT / "data" / "questions" / "completed_questions.json"
QUESTIONS_DIR = ROOT / "questions"
REPORT_DIR = ROOT / "docs" / "reports"
SITE_URL = "https://mei-chan-nel.github.io/info1-quiz-app/"
PORTAL_URL = "https://mei-chan-nel.github.io/"
ADSENSE_CLIENT = "ca-pub-6257644709224446"
PAGE_SIZE = 10
REVIEW_DATE = date.today()
PROTECTED_APP_FILES = (
    "app/index.html",
    "app/app.js",
    "app/startup.js",
    "app/styles.css",
    "app/issue-report.js",
    "app/issue-report.css",
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
    return questions


def page_filename(field: dict, page_number: int) -> str:
    suffix = "" if page_number == 1 else f"-{page_number}"
    return f"{field['slug']}{suffix}.html"


def canonical(path: str) -> str:
    return SITE_URL + path.lstrip("/")


def head(title: str, description: str, path: str, prefix: str, *, ads: bool) -> str:
    ad_script = ""
    if ads:
        ad_script = (
            f'\n    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" '
            'crossorigin="anonymous"></script>'
        )
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <meta name="theme-color" content="#102f35" />
    <link rel="canonical" href="{esc(canonical(path))}" />
    <link rel="icon" href="{PORTAL_URL}assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="{PORTAL_URL}assets/site.css" />{ad_script}
  </head>"""


def header(prefix: str, current: str) -> str:
    nav_items = [
        ("home", PORTAL_URL, "学習トップ"),
        ("questions", f"{prefix}questions/index.html", "問題一覧"),
        ("archive", f"{PORTAL_URL}archive/", "動画問題"),
        ("app", f"{prefix}app/", "学習アプリ"),
        ("about", f"{PORTAL_URL}about.html", "このサイトについて"),
    ]
    links = []
    for key, href, label in nav_items:
        current_attr = ' aria-current="page"' if key == current else ""
        links.append(f'<a href="{href}"{current_attr}>{label}</a>')
    return f"""
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="{PORTAL_URL}" aria-label="情報Ⅰ Study Atlas トップ">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識問題と解説</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">{''.join(links)}</nav>
      </div>
    </header>"""


def footer(prefix: str) -> str:
    return f"""
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <p class="footer-brand">情報Ⅰ Study Atlas</p>
          <p class="footer-copy">知識を、繋ぎ、ひろげる。</p>
        </div>
        <nav aria-label="フッターナビゲーション">
          <a href="{prefix}questions/index.html">問題一覧</a>
          <a href="{PORTAL_URL}archive/">動画問題</a>
          <a href="{PORTAL_URL}books/">問題集</a>
          <a href="{prefix}app/">学習アプリ</a>
          <a href="{PORTAL_URL}about.html">このサイトについて</a>
          <a href="{PORTAL_URL}privacy.html">プライバシーポリシー</a>
          <a href="{PORTAL_URL}sitemap.html">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>
    </footer>
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




def render_questions_index(grouped: dict[str, list[dict]]) -> None:
    total = sum(len(items) for items in grouped.values())
    cards = "".join(field_card(field, len(grouped[field["id"]]), page_filename(field, 1)) for field in FIELDS)
    body = f"""{head('問題一覧 | 情報Ⅰ Study Atlas', f'情報Ⅰの知識問題{total}問を6分野に分類。正答・解説・出典・タグを読みながら学べます。', 'questions/index.html', '../', ads=True)}
  <body>
    {header('../', 'questions')}
    <main id="main-content" class="subpage">
      {breadcrumb([('学習トップ', PORTAL_URL), ('問題一覧', None)])}
      <section class="page-hero compact-hero">
        <p class="eyebrow">QUESTION LIBRARY</p><h1>問題一覧</h1>
        <p>全{total}問を主分野ごとに整理しています。正答と解説は各問の「正答と解説を確認」から開けます。暗記ではなく、選択肢を見分ける根拠まで読んでみてください。</p>
      </section>
      <section class="library-notes" aria-label="一覧の使い方">
        <article><strong>6分野</strong><span>学習内容の主題で各問を1つの分野へ分類</span></article>
        <article><strong>10問</strong><span>読みやすさのため1ページの上限を設定</span></article>
        <article><strong>根拠付き</strong><span>正答・解説・出典・タグをまとめて掲載</span></article>
      </section>
      <section class="section no-top-padding" aria-labelledby="choose-field"><div class="section-heading"><div><p class="eyebrow">CHOOSE A FIELD</p><h2 id="choose-field">分野を選ぶ</h2></div></div><div class="field-grid">{cards}</div></section>
      <aside class="content-note"><h2>掲載内容について</h2><p>問題は共通テスト「情報Ⅰ」の学習用として作成・改題したものです。公式の問題・解答・解説ではありません。出典表示は各問題に記載しています。誤りや範囲についてお気づきの点は、<a href="{PORTAL_URL}about.html#contact">お問い合わせ先</a>からお知らせください。</p></aside>
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


def render_question(question: dict, number: int) -> str:
    choices = "".join(
        f'<li><span>{esc(choice.get("label", ""))}</span><p>{esc(choice.get("text", ""))}</p></li>'
        for choice in question.get("choices", [])
    )
    correct = answer_choice(question)
    if not correct:
        raise ValueError(f"{question['id']}: correct choice not found")
    source = str(question.get("source_display", "")).strip() or "独自作成"
    if question.get("改題") is True and "改題" not in source:
        source += "（改題）"
    tags = "".join(f"<li>{esc(tag)}</li>" for tag in question.get("tags", []))
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
              <dl class="source-row"><dt>出典</dt><dd>{esc(source)}</dd></dl>
              <div class="tag-row"><span>タグ</span><ul>{tags}</ul></div>
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


def render_field_pages(field: dict, questions: list[dict]) -> list[str]:
    paths: list[str] = []
    total_pages = math.ceil(len(questions) / PAGE_SIZE)
    for page_number in range(1, total_pages + 1):
        filename = page_filename(field, page_number)
        path = f"questions/{filename}"
        paths.append(path)
        page_questions = questions[(page_number - 1) * PAGE_SIZE : page_number * PAGE_SIZE]
        start_number = (page_number - 1) * PAGE_SIZE + 1
        end_number = start_number + len(page_questions) - 1
        cards = "".join(render_question(question, index) for index, question in enumerate(page_questions, start=start_number))
        page_suffix = f"（{page_number}/{total_pages}ページ）" if total_pages > 1 else ""
        description = f"情報Ⅰ「{field['label']}」の知識問題{start_number}〜{end_number}。正答・解説・出典・タグを掲載しています。"
        body = f"""{head(f'{field["label"]}の問題 {page_suffix} | 情報Ⅰ Study Atlas', description, path, '../', ads=True)}
  <body>
    {header('../', 'questions')}
    <main id="main-content" class="subpage question-page">
      {breadcrumb([('学習トップ', PORTAL_URL), ('問題一覧', 'index.html'), (field['label'], None)])}
      <section class="field-hero accent-{field['accent']}">
        <div><p class="eyebrow">FIELD {field['number']}</p><h1>{esc(field['label'])}</h1><p>{esc(field['intro'])}</p></div>
        <dl><div><dt>掲載数</dt><dd>{len(questions)}問</dd></div><div><dt>このページ</dt><dd>{start_number}–{end_number}問</dd></div></dl>
      </section>
      {pagination(field, page_number, total_pages, top=True)}
      <section class="question-list" aria-label="{esc(field['label'])}の問題">{cards}</section>
      {pagination(field, page_number, total_pages)}
      <aside class="next-action"><div><p class="eyebrow">PRACTICE</p><h2>読んだ知識をランダム出題で確認</h2><p>学習アプリでは「{esc(field['label'])}」を選んで、1〜50問に挑戦できます。</p></div><a class="button button-primary" href="../app/">学習アプリを開く</a></aside>
    </main>
    {footer('../')}"""
        (QUESTIONS_DIR / filename).write_text(body, encoding="utf-8")
    return paths






def protected_app_hashes() -> dict[str, str]:
    return {
        relative: hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
        for relative in PROTECTED_APP_FILES
    }


def write_build_report(grouped: dict[str, list[dict]], generated_paths: list[str]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    baseline_path = REPORT_DIR / "app-core-baseline-sha256.json"
    if not baseline_path.exists():
        baseline_path.write_text(json.dumps(protected_app_hashes(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "generated_on": REVIEW_DATE.isoformat(),
        "generator": "scripts/generate_question_pages.py",
        "question_source": QUESTION_PATH.relative_to(ROOT).as_posix(),
        "question_count": sum(len(items) for items in grouped.values()),
        "page_size": PAGE_SIZE,
        "field_counts": {field["id"]: len(grouped[field["id"]]) for field in FIELDS},
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

    if QUESTIONS_DIR.resolve().parent != ROOT.resolve():
        raise RuntimeError("Refusing to regenerate questions outside the repository root")
    if QUESTIONS_DIR.exists():
        shutil.rmtree(QUESTIONS_DIR)
    QUESTIONS_DIR.mkdir(parents=True)

    render_questions_index(grouped)
    generated_paths: list[str] = []
    for field in FIELDS:
        generated_paths.extend(render_field_pages(field, grouped[field["id"]]))
    write_build_report(grouped, generated_paths)
    print(f"questions={len(questions)} field_pages={len(generated_paths)} question_library_pages={len(generated_paths) + 1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
