# 問題一覧の生成・所有範囲

更新日: 2026-07-20

## このリポジトリが所有するもの

- `app/`: 既存学習アプリ
- `data/questions/`: 問題データ、主分野、スキーマ
- `questions/`: 読むための問題一覧
- `docs/reports/question-library-build.json`: ポータルのサイトマップ生成に渡す公開ページ一覧

ポータルトップ、サイト案内、全体プライバシーポリシー、利用者向け `sitemap.html`、共通CSS・favicon・ヘッダー／フッター生成スクリプト、`ads.txt`、`robots.txt`、`sitemap.xml` は、`mei-chan-nel.github.io` リポジトリが所有する。

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

- 全問題: 1,000問
- 問題一覧ページ: 104ページ（一覧トップ1、分野ページ102、タグ検索1）
- 1ページ上限: 10問
- 元データの全613タグのうち、全1,000問で4問以上に付く244タグだけを公開する。3問以下の低頻度タグはタグ一覧・問題本体・検索データのすべてで非表示とする
- 公開タグを通常リンクとして表示し、`questions/tags.html?tag=...` で複数タグのOR検索を行う
- タグ一覧は主分野別に6グループへ分ける。問題内のタグリンクは単独検索とし、元の問題を結果の先頭へ置いて一覧上端へスクロールする
- 未分類: 0問
- 重複掲載: 0問
- 未掲載: 0問

生成対象一覧と分野別件数は `docs/reports/question-library-build.json` に保存する。
同レポートには公開下限、非表示タグ数、公開タグが0件になった問題数も記録し、再生成後に検証できるようにする。

## アプリ保護

`docs/reports/app-core-baseline-sha256.json` と `app/index.html`、`app/app.js`、`app/startup.js`、`app/styles.css`、`app/issue-report.js`、`app/issue-report.css`、`app/learning-record.js` を比較し、意図しないアプリ変更を検知する。基準値は意図したアプリ変更を検証した時点で更新する。サイト案内とプライバシーポリシーはポータルへ統合し、アプリは出題・遷移・集計処理を変更せず、フッターだけをポータル共通のサイトシェルへ接続する。

## ポータルへのリンク

問題一覧のヘッダーとフッターは、全ページで `/assets/site-header.js` を読み込み、ポータルと同じリンク順・名称・ブランド表記を使用する。生成前のHTMLにも同じ構成を出力し、生成後の検証では共通スクリプトの欠落を検出する。
