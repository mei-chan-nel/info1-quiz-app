# 情報Ⅰ Study Atlas — アプリ・問題検索

共通テスト「情報Ⅰ」の問題データ、タグ検索、学習アプリを管理します。ポータルのトップ、講義ノート、解説動画、書籍案内は隣接する [`mei-chan-nel.github.io`](https://github.com/mei-chan-nel/mei-chan-nel.github.io) で管理します。

## 現在の公開構成

- `questions/index.html`：1,438問を225タグでAND検索する唯一の正規検索ページ。
- `questions/tags.html`：旧URLを正規検索ページへ移すnoindex互換スタブ。通常リンク・canonical・サイトマップでは使用しません。
- `app/`：分野・回答状況・問題数を選べる学習アプリ。回答履歴、保存、間違い、類題、結果画面、タグからの出題を保持します。

## フォルダ構成

```text
questions/index.html       タグ検索ページ（静的カード1,438問）
questions/tags.html        旧URL互換リダイレクト
app/                       学習アプリ本体
data/questions/            問題データ・スキーマ
scripts/generate_question_pages.py
scripts/validate_question_pages.py
docs/reports/              生成・検証レポート
```

## 生成と検証

```powershell
python scripts/classify_questions.py --check
python scripts/normalize_question_tags.py
python scripts/generate_question_pages.py
python scripts/validate_question_pages.py --portal-root <mei-chan-nel.github.ioのリポジトリルート>
```

生成時に問題IDの一意性、225タグ、AND検索、段階表示、アプリ出題への遷移、正規URL、互換スタブを確認します。`docs/reports/question-library-build.json` はポータルのサイトマップ生成に渡す正規公開ページを記録します。

問題の登録順は `data/questions/completed_questions.json` の配列順です。新しい問題は配列の末尾へ追加し、既存問題の順序は変更しません。`generate_question_pages.py` は公開カードを登録順の逆（新着順）で生成し、`validate_question_pages.py` がその順序を検証します。生成済みの `questions/index.html` を直接並べ替えないでください。

## ローカル確認

```powershell
python scripts/quiz_server.py --host 127.0.0.1 --port 8765
```

```text
http://127.0.0.1:8765/questions/
http://127.0.0.1:8765/app/
```

学習記録は利用者のブラウザ内に保存します。選択肢集計と範囲外報告は、公開用のSupabaseキーからRPCを呼び出します。secret keyやデータベースパスワードは含めません。

## 正規URL

```text
https://mei-chan-nel.com/info1-quiz-app/questions/
https://mei-chan-nel.com/info1-quiz-app/app/
```
