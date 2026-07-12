# 問題一覧の生成・所有範囲

更新日: 2026-07-12

## このリポジトリが所有するもの

- `app/`: 既存学習アプリ
- `data/questions/`: 問題データ、主分野、スキーマ
- `questions/`: 読むための問題一覧
- `docs/reports/question-library-build.json`: ポータルのサイトマップ生成に渡す公開ページ一覧

ポータルトップ、サイト案内、全体プライバシーポリシー、共通CSS・favicon、`ads.txt`、`robots.txt`、`sitemap.xml` は、`mei-chan-nel.github.io` リポジトリが所有する。

## 生成手順

```powershell
python scripts/classify_questions.py --check
python scripts/generate_question_pages.py
python scripts/validate_question_pages.py
```

問題データの主分野を再分類するときだけ、最初に次を実行する。

```powershell
python scripts/classify_questions.py --apply
```

## 現在の生成結果

- 全問題: 861問
- 問題一覧ページ: 33ページ（一覧トップ1、分野ページ32）
- 1ページ上限: 30問
- 未分類: 0問
- 重複掲載: 0問
- 未掲載: 0問

生成対象一覧と分野別件数は `docs/reports/question-library-build.json` に保存する。

## アプリ保護

`docs/reports/app-core-baseline-sha256.json` と `app/index.html`、`app/app.js`、`app/startup.js`、`app/styles.css` を比較し、意図しないアプリ変更を検知する。サイト案内とプライバシーポリシーはポータルへ統合し、アプリのフッターはポータル3ページへ直接リンクする。

## ポータルへのリンク

問題一覧の「学習トップ」「このサイトについて」「プライバシーポリシー」は `https://mei-chan-nel.github.io/` 側へリンクする。問題一覧と学習アプリの相互リンクは、このリポジトリ内の相対URLを使う。
