# 問題検索の生成・所有範囲

更新日: 2026-08-08

## 所有範囲

- `app/`: 学習アプリ本体
- `data/questions/`: 1,438問のデータ、主分野、スキーマ
- `questions/index.html`: タグ検索の正規ページ
- `questions/tags.html`: 旧URL互換スタブ
- `docs/reports/question-library-build.json`: ポータルサイトマップへ渡す公開ページ情報

## 現在の生成結果

- 問題: 1,438問、重複掲載0、未掲載0
- 公開タグ: 229種類（`共通テスト` は検索UIから除外）
- 公開HTML: `questions/index.html` と `questions/tags.html` の2枚
- 検索: 複数タグのAND条件、URLフラグメント、段階表示、タグ条件からのアプリ出題
- アプリ復帰: 本番では `/info1-quiz-app/questions/` を正規URLとし、配置先からの相対解決によりローカル確認でも検索条件を保持して戻る

## 生成手順

```powershell
python scripts/classify_questions.py --check
python scripts/normalize_question_tags.py
python scripts/generate_question_pages.py
python scripts/validate_question_pages.py --portal-root <ポータルのルート>
```

`generate_question_pages.py` は分野別HTMLやキーワード一覧を生成しません。旧 `tags.html` は互換リダイレクトとして毎回再生成し、通常の内部リンク、canonical、サイトマップには出力しません。

## アプリ保護

`docs/reports/app-core-baseline-sha256.json` に、出題・履歴・類題などのアプリ本体とタグ出題連携の基準ハッシュを記録します。URL連携を除く既存機能が意図せず変更されていないことを `validate_question_pages.py` で確認します。

## ポータルとの共有

検索ページはポータルの `assets/site.css`、`assets/favicon.svg`、`assets/site-header.js` を相対参照します。ポータルの `sitemap.xml` は本レポートの `questions/index.html` とアプリトップだけを取り込みます。
