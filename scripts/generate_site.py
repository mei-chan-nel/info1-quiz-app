from __future__ import annotations

import hashlib
import html
import json
import math
import shutil
from collections import defaultdict
from datetime import date
from pathlib import Path

from classify_questions import FIELD_LABELS, validate_field_ids


ROOT = Path(__file__).resolve().parents[1]
QUESTION_PATH = ROOT / "data" / "questions" / "completed_questions.json"
QUESTIONS_DIR = ROOT / "questions"
REPORT_DIR = ROOT / "docs" / "reports"
SITE_URL = "https://mei-chan-nel.github.io/info1-quiz-app/"
ADSENSE_CLIENT = "ca-pub-6257644709224446"
PAGE_SIZE = 30
REVIEW_DATE = date(2026, 7, 12)
REVIEW_DATE_LABEL = "2026年7月12日"

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

FIELD_BY_ID = {field["id"]: field for field in FIELDS}


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
    <link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="{prefix}assets/site.css" />{ad_script}
  </head>"""


def header(prefix: str, current: str) -> str:
    nav_items = [
        ("home", f"{prefix}index.html", "学習トップ"),
        ("questions", f"{prefix}questions/index.html", "問題一覧"),
        ("app", f"{prefix}app/", "学習アプリ"),
        ("about", f"{prefix}about.html", "このサイトについて"),
    ]
    links = []
    for key, href, label in nav_items:
        current_attr = ' aria-current="page"' if key == current else ""
        links.append(f'<a href="{href}"{current_attr}>{label}</a>')
    return f"""
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="{prefix}index.html" aria-label="情報Ⅰ Study Atlas トップ">
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
          <p class="footer-copy">知識を読む。問題で確かめる。根拠まで振り返る。</p>
        </div>
        <nav aria-label="フッターナビゲーション">
          <a href="{prefix}questions/index.html">問題一覧</a>
          <a href="{prefix}app/">学習アプリ</a>
          <a href="{prefix}about.html">このサイトについて</a>
          <a href="{prefix}privacy.html">プライバシーポリシー</a>
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


def render_home(grouped: dict[str, list[dict]]) -> None:
    total = sum(len(items) for items in grouped.values())
    cards = "".join(field_card(field, len(grouped[field["id"]]), f"questions/{page_filename(field, 1)}") for field in FIELDS)
    body = f"""{head('情報Ⅰ Study Atlas | 知識問題と解説', f'共通テスト「情報Ⅰ」の基礎知識を、6分野・全{total}問の問題と解説で学べる無料学習サイトです。', '', './', ads=True)}
  <body>
    {header('./', 'home')}
    <main id="main-content">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">COMMON TEST · INFORMATION I</p>
          <h1>知識を、<br /><em>点ではなく地図</em>にする。</h1>
          <p class="hero-lead">共通テスト「情報Ⅰ」の基礎を6つの分野に整理。問題・正答・解説・出典を読みながら、理解の抜けを見つけられます。</p>
          <div class="hero-actions">
            <a class="button button-primary" href="questions/index.html">問題一覧から読む</a>
            <a class="button button-ghost" href="app/">ランダムに挑戦する</a>
          </div>
          <dl class="hero-stats">
            <div><dt>掲載問題</dt><dd>{total}<span>問</span></dd></div>
            <div><dt>学習分野</dt><dd>6<span>分野</span></dd></div>
            <div><dt>1ページ</dt><dd>最大30<span>問</span></dd></div>
          </dl>
        </div>
        <div class="hero-map" aria-hidden="true">
          <span class="map-orbit orbit-one"></span><span class="map-orbit orbit-two"></span>
          <div class="map-core"><strong>情報Ⅰ</strong><small>KNOWLEDGE<br />ATLAS</small></div>
          <span class="map-node node-a">社会</span><span class="map-node node-b">表現</span>
          <span class="map-node node-c">通信</span><span class="map-node node-d">データ</span>
          <span class="map-node node-e">手順</span><span class="map-node node-f">デザイン</span>
        </div>
      </section>

      <section class="section section-fields" aria-labelledby="fields-heading">
        <div class="section-heading"><div><p class="eyebrow">SIX LEARNING FIELDS</p><h2 id="fields-heading">6分野から理解を広げる</h2></div><p>気になる分野から始めても、順番に読んでも構いません。各問の正答と解説は、その場で開いて確認できます。</p></div>
        <div class="field-grid">{cards}</div>
      </section>

      <section class="section reading-guide" aria-labelledby="guide-heading">
        <div class="guide-copy"><p class="eyebrow">HOW TO STUDY</p><h2 id="guide-heading">読む学習と、解く学習を往復する</h2><p>一覧は答え合わせだけのページではありません。問題文で状況を捉え、選択肢の違いを考え、解説で根拠を言葉にするための読み物です。</p><a class="text-link" href="questions/index.html">学習コンテンツを開く <span aria-hidden="true">→</span></a></div>
        <ol class="step-list">
          <li><span>01</span><div><h3>問いを読む</h3><p>正答を開く前に、用語と条件から答えの根拠を考えます。</p></div></li>
          <li><span>02</span><div><h3>解説で確かめる</h3><p>正解だけでなく、なぜその選択肢になるのかを確認します。</p></div></li>
          <li><span>03</span><div><h3>アプリで定着させる</h3><p>分野を選び、ランダム出題で思い出せるかを試します。</p></div></li>
        </ol>
      </section>

      <section class="section editorial-section" aria-labelledby="editorial-heading">
        <div><p class="eyebrow">EDITORIAL POLICY</p><h2 id="editorial-heading">問題を掲載するまで</h2></div>
        <div class="editorial-grid">
          <article><span>1</span><h3>学習範囲を確認</h3><p>情報Ⅰの基本用語・仕組み・基本計算を中心に扱います。</p></article>
          <article><span>2</span><h3>学習用に再構成</h3><p>公開問題を参考にする場合は、設定や選択肢を学習目的に合わせて改題します。</p></article>
          <article><span>3</span><h3>根拠を明示</h3><p>各問に正答・解説・出典表示・タグを付け、振り返れる形で掲載します。</p></article>
          <article><span>4</span><h3>分類して公開</h3><p>全問に主分野を設定し、未分類や必須項目の欠落を自動検査します。</p></article>
        </div>
        <p class="editorial-note">問題作成・改題・分類・解説の下書きや見直しにはAIを利用しています。自動生成したまま公開するのではなく、既存の確認済み問題データを基にページを生成し、件数・必須項目・リンク・表示を検証しています。詳しくは<a href="about.html">このサイトについて</a>をご覧ください。</p>
      </section>

      <section class="app-cta">
        <div><p class="eyebrow">READY FOR A QUIZ?</p><h2>覚えた知識を、5問から試す。</h2><p>分野と問題数を選び、正答率や選択肢ごとの解説を確認できます。</p></div>
        <a class="button button-light" href="app/">学習アプリを開く <span aria-hidden="true">↗</span></a>
      </section>
    </main>
    {footer('./')}"""
    (ROOT / "index.html").write_text(body, encoding="utf-8")


def render_questions_index(grouped: dict[str, list[dict]]) -> None:
    total = sum(len(items) for items in grouped.values())
    cards = "".join(field_card(field, len(grouped[field["id"]]), page_filename(field, 1)) for field in FIELDS)
    body = f"""{head('問題一覧 | 情報Ⅰ Study Atlas', f'情報Ⅰの知識問題{total}問を6分野に分類。正答・解説・出典・タグを読みながら学べます。', 'questions/index.html', '../', ads=True)}
  <body>
    {header('../', 'questions')}
    <main id="main-content" class="subpage">
      {breadcrumb([('学習トップ', '../index.html'), ('問題一覧', None)])}
      <section class="page-hero compact-hero">
        <p class="eyebrow">QUESTION LIBRARY</p><h1>問題一覧</h1>
        <p>全{total}問を主分野ごとに整理しています。正答と解説は各問の「正答と解説を確認」から開けます。暗記ではなく、選択肢を見分ける根拠まで読んでみてください。</p>
      </section>
      <section class="library-notes" aria-label="一覧の使い方">
        <article><strong>6分野</strong><span>学習内容の主題で各問を1つの分野へ分類</span></article>
        <article><strong>30問</strong><span>読みやすさのため1ページの上限を設定</span></article>
        <article><strong>根拠付き</strong><span>正答・解説・出典・タグをまとめて掲載</span></article>
      </section>
      <section class="section no-top-padding" aria-labelledby="choose-field"><div class="section-heading"><div><p class="eyebrow">CHOOSE A FIELD</p><h2 id="choose-field">分野を選ぶ</h2></div></div><div class="field-grid">{cards}</div></section>
      <aside class="content-note"><h2>掲載内容について</h2><p>問題は共通テスト「情報Ⅰ」の学習用として作成・改題したものです。公式の問題・解答・解説ではありません。出典表示は各問題に記載しています。誤りや範囲についてお気づきの点は、<a href="../about.html#contact">お問い合わせ先</a>からお知らせください。</p></aside>
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
    numbered = []
    for number in range(1, total_pages + 1):
        if number == current:
            numbered.append(f'<span aria-current="page">{number}</span>')
        else:
            numbered.append(f'<a href="{page_filename(field, number)}" aria-label="{number}ページ目">{number}</a>')
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
      {breadcrumb([('学習トップ', '../index.html'), ('問題一覧', 'index.html'), (field['label'], None)])}
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


def render_about(total: int) -> None:
    body = f"""{head('このサイトについて | 情報Ⅰ Study Atlas', '情報Ⅰ Study Atlasの目的、問題の作成・改題・確認方針、AIの利用、運営者とお問い合わせ先をご案内します。', 'about.html', './', ads=False)}
  <body>
    {header('./', 'about')}
    <main id="main-content" class="subpage prose-page">
      {breadcrumb([('学習トップ', 'index.html'), ('このサイトについて', None)])}
      <header class="page-hero"><p class="eyebrow">ABOUT THIS SITE</p><h1>このサイトについて</h1><p>「情報Ⅰ」の基礎知識を、読む学習と問題演習の両方から身につけるための学習サイトです。</p></header>
      <article class="prose-content">
        <section><h2>サイトの目的</h2><p>情報Ⅰ Study Atlasは、共通テスト「情報Ⅰ」の第1問・第2問を中心とする基本知識と基本計算の学習を支援するために運営しています。現在、{total}問を6分野に整理し、問題一覧では正答・解説・出典・タグを、学習アプリではランダム出題と結果集計を提供しています。</p></section>
        <section><h2>おすすめの使い方</h2><ol><li>問題一覧で分野の問題と解説を読む</li><li>分からない用語や、選択肢を区別する根拠を確認する</li><li>学習アプリで分野を選び、思い出せるか試す</li><li>誤答した分野の一覧へ戻り、解説を読み直す</li></ol></section>
        <section id="editorial-policy"><h2>問題の作成・改題方針</h2><p>情報Ⅰの学習に役立つ基本用語、基本的な仕組み、短い条件の読み取り、基本計算を扱います。IPAが公開している情報処理技術者試験等の公開問題や、大学入試センターが公開している共通テストの問題を参考に、学習用として設定の簡略化、選択肢の再構成、解説の追加などを行った問題を含みます。</p><p>参照した問題がある場合は、各問題の出典欄に試験名・問題番号と改題状況を表示します。当サイトは公式問題の転載集ではなく、情報Ⅰの学習目的に合わせて再構成した問題と独自の解説を掲載するものです。公式の問題・解答・解説に代わるものではありません。</p></section>
        <section><h2>分類・公開時の確認</h2><p>各問題には6分野のうち主分野を1つ設定しています。新しい問題は、問題文、選択肢、正答、解説、タグ、出典、主分野を必須項目として確認し、未分類やリンク切れがある状態では公開用ページを生成しない仕組みにしています。ページ分割や一覧生成は自動化していますが、掲載元は確認済みとして管理している問題データです。</p></section>
        <section><h2>AIの利用</h2><p>問題の作成、改題、分類、解説の下書き・見直しにはAIを利用しています。AIの出力をそのまま正しいものとは扱わず、問題データとしての整合性確認、出典表示、分野分類、公開ページの検証を行います。それでも誤りや不十分な点が残る可能性があるため、ご指摘を受けた内容は確認し、必要に応じて修正します。</p></section>
        <section><h2>公式サイトとの関係</h2><p>当サイトは、IPAおよび大学入試センターの公式サイト・公式サービスではなく、両団体との提携、承認、推奨を示すものではありません。試験制度や出題に関する正確な情報は、各団体の公式サイトでご確認ください。</p></section>
        <section><h2>運営者</h2><p>運営者：めいちゃんねる<br />X：<a href="https://x.com/mei_chan_nel" target="_blank" rel="noopener noreferrer">@mei_chan_nel</a></p></section>
        <section id="contact"><h2>お問い合わせ</h2><p>不具合、問題文・選択肢・解説・出典の誤り、情報Ⅰの範囲に関するご指摘は、以下のフォームまたはXのDMからお願いいたします。</p><p><a class="inline-button" href="https://docs.google.com/forms/d/e/1FAIpQLSc5mWAVVTLXWNWwl1YOL57AnTtAcJ3tmnFEBTajJHHlrwmdNQ/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer">お問い合わせフォームを開く</a></p><p class="small-note">内容によっては返信まで時間をいただく場合があります。また、すべてのお問い合わせへの返信を保証するものではありません。</p></section>
        <section><h2>更新情報</h2><p>学習コンテンツ公開日：2026年7月12日<br />問題データ・分類の確認日：{REVIEW_DATE_LABEL}</p></section>
      </article>
    </main>
    {footer('./')}"""
    (ROOT / "about.html").write_text(body, encoding="utf-8")


def render_privacy() -> None:
    body = f"""{head('プライバシーポリシー | 情報Ⅰ Study Atlas', '情報Ⅰ Study Atlasにおける個人情報、学習データ、Cookie、広告配信、外部サービスの取扱いをご案内します。', 'privacy.html', './', ads=False)}
  <body>
    {header('./', 'privacy')}
    <main id="main-content" class="subpage prose-page">
      {breadcrumb([('学習トップ', 'index.html'), ('プライバシーポリシー', None)])}
      <header class="page-hero"><p class="eyebrow">PRIVACY POLICY</p><h1>プライバシーポリシー</h1><p>当サイトで利用する学習データ、Cookie、広告配信、外部サービスの取扱いを説明します。</p></header>
      <article class="prose-content">
        <section><h2>個人情報の取得</h2><p>当サイトは利用者登録機能を設けておらず、通常の閲覧や問題演習で、氏名・住所・電話番号などの個人を特定する情報を直接取得しません。お問い合わせフォームやXのDMからご連絡いただいた場合は、返信や対応のために送信されたお名前、メールアドレス、アカウント、問い合わせ内容等を確認することがあります。</p></section>
        <section><h2>問題演習に関するデータ</h2><p>学習の利便性のため、問題ごとの解答回数と正解数を利用者のブラウザのローカルストレージに保存します。ブラウザのサイトデータを削除すると、この情報も削除されます。選んだ選択肢は、その挑戦の結果表示と集計のために扱います。</p></section>
        <section><h2>匿名の集計データとSupabase</h2><p>問題改善と選択率表示のため、結果画面の表示後に、問題ID、選んだ選択肢のID、正誤、範囲外報告を匿名の集計データとしてSupabaseへ送信します。氏名、メールアドレス、住所、電話番号、ログイン情報は含めず、個人を識別する解答履歴や挑戦IDは保存しません。</p></section>
        <section><h2>広告配信</h2><p>当サイトでは、第三者配信の広告サービスであるGoogle AdSenseを利用する場合があります。Googleなどの第三者配信事業者は、Cookie、ウェブビーコン、IPアドレスその他の識別子を利用し、当サイトや他サイトへの過去のアクセス情報に基づく広告を配信することがあります。</p><p>利用者は<a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">Googleの広告設定</a>からパーソナライズ広告を無効にできます。Googleによるデータ利用については、<a href="https://policies.google.com/technologies/partner-sites?hl=ja" target="_blank" rel="noopener noreferrer">Googleがパートナーのサイトやアプリでデータを使用する方法</a>をご確認ください。適用される法令とGoogleの要件に応じ、必要な同意取得や情報提供を行います。</p><p>このプライバシーポリシーとサイト案内ページには広告コードを設置していません。</p></section>
        <section><h2>Cookieとローカルストレージ</h2><p>広告配信や利便性向上のためにCookieが使用される場合があります。また、学習状況の保存にローカルストレージを使用します。Cookieはブラウザ設定から無効化でき、ローカルストレージの情報はブラウザのサイトデータを削除することで消去できます。無効化や削除により、一部機能が正しく動作しない場合があります。</p></section>
        <section><h2>外部サービス</h2><p>匿名集計にSupabase、お問い合わせにGoogleフォーム、広告配信にGoogle AdSenseを利用する場合があります。また、連絡手段としてXを案内しています。各サービスの利用時には、それぞれの利用規約とプライバシーポリシーが適用されます。</p></section>
        <section><h2>第三者提供</h2><p>法令に基づく場合を除き、取得した個人情報を本人の同意なく第三者へ提供しません。</p></section>
        <section><h2>免責事項</h2><p>掲載内容の正確性に配慮していますが、完全性、最新性、特定の試験での出題を保証するものではありません。当サイトの利用によって生じた損害について、運営者は責任を負いかねます。</p></section>
        <section><h2>変更とお問い合わせ</h2><p>本方針は必要に応じて変更し、掲載時点から有効とします。お問い合わせは<a href="about.html#contact">このサイトについて</a>に記載の窓口からお願いいたします。</p><p>制定日：2026年7月10日<br />最終改定日：2026年7月12日</p></section>
      </article>
    </main>
    {footer('./')}"""
    (ROOT / "privacy.html").write_text(body, encoding="utf-8")


def render_machine_files(generated_paths: list[str]) -> None:
    sitemap_paths = ["", "questions/index.html", *generated_paths, "about.html", "privacy.html", "app/"]
    urls = []
    for path in sitemap_paths:
        loc = esc(canonical(path))
        urls.append(f"  <url><loc>{loc}</loc><lastmod>{REVIEW_DATE.isoformat()}</lastmod></url>")
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {canonical('sitemap.xml')}\n", encoding="utf-8")
    (ROOT / "ads.txt").write_text("google.com, pub-6257644709224446, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")


def app_hashes() -> dict[str, str]:
    return {
        path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted((ROOT / "app").glob("*"))
        if path.is_file()
    }


def write_build_report(grouped: dict[str, list[dict]], generated_paths: list[str]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    baseline_path = REPORT_DIR / "app-baseline-sha256.json"
    if not baseline_path.exists():
        baseline_path.write_text(json.dumps(app_hashes(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "generated_on": REVIEW_DATE.isoformat(),
        "generator": "scripts/generate_site.py",
        "question_source": QUESTION_PATH.relative_to(ROOT).as_posix(),
        "question_count": sum(len(items) for items in grouped.values()),
        "page_size": PAGE_SIZE,
        "field_counts": {field["id"]: len(grouped[field["id"]]) for field in FIELDS},
        "learning_pages": ["index.html", "questions/index.html", *generated_paths],
        "ad_free_pages": ["about.html", "privacy.html"],
        "app_files_changed_by_generator": False,
    }
    (REPORT_DIR / "site-build.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    (ROOT / "assets").mkdir(parents=True, exist_ok=True)

    render_home(grouped)
    render_questions_index(grouped)
    generated_paths: list[str] = []
    for field in FIELDS:
        generated_paths.extend(render_field_pages(field, grouped[field["id"]]))
    render_about(len(questions))
    render_privacy()
    render_machine_files(generated_paths)
    write_build_report(grouped, generated_paths)
    print(f"questions={len(questions)} field_pages={len(generated_paths)} total_public_pages={len(generated_paths) + 5}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
