# 情報Ⅰ Study Atlas

共通テスト「情報Ⅰ」の第1問・第2問で問われる知識問題と基本計算問題を、読む学習コンテンツとWebアプリの両方で学ぶサイトです。

- 6分野・全861問の問題一覧
- 正答、解説、出典、タグを掲載
- 1ページ最大30問の静的ページ
- 分野と問題数を選べる既存の学習アプリ

## 問題について

本アプリの問題には、IPAが公開している情報処理技術者試験等の公開問題を参考にして独自に改題・再構成したものが含まれます。

各問題の出典情報は、問題データ内の `source_display` および `source_question_ids` に記録しています。

本アプリはIPAおよび大学入試センターの公式サービスではありません。

## フォルダ構成

```text
index.html
about.html
privacy.html
assets/
  site.css
questions/
  index.html
  <6分野の生成ページ>.html
app/
  index.html
  app.js
  styles.css
data/questions/
  completed_questions.json
  question.schema.json
scripts/
  classify_questions.py
  generate_site.py
  validate_site.py
  quiz_server.py
```

`app/` は既存の学習アプリです。ルートと `questions/` は問題データから生成する学習サイトです。

## 分類・サイト生成・検証

問題データへ主分野を設定し直す場合は、次を実行します。

```powershell
python scripts/classify_questions.py --apply
```

通常のサイト更新は、問題データを更新した後に次を実行します。

```powershell
python scripts/classify_questions.py --check
python scripts/generate_site.py
python scripts/validate_site.py
```

`generate_site.py` は `questions/` を再生成します。`validate_site.py` は全問題の一意掲載、ページ上限、内部リンク、広告コード範囲、サイトマップ、アプリ保護ハッシュを検査します。

分類と検証の記録は `docs/reports/` に生成されます。

## ローカルで動かす

Python 3が入っている環境で、リポジトリのルートから次を実行します。

```powershell
python scripts/quiz_server.py --host 127.0.0.1 --port 8765
```

ブラウザで学習サイトのトップを開きます。

```text
http://127.0.0.1:8765/
```

学習アプリは `http://127.0.0.1:8765/app/` です。

`start_local_server.bat` をダブルクリックして起動することもできます。

## 公開について

GitHub Pagesなどの静的ホスティングでも、問題表示・解答・結果表示は動きます。
選択肢の集計と範囲外報告は、ブラウザからSupabaseのRPCを呼び出して保存します。

フロントエンドに置くのはSupabaseのPublishable keyのみです。secret key、service_role key、データベースパスワード、接続文字列は使用せず、リポジトリにも含めません。

## GitHub Pagesで試験公開する場合

リポジトリをGitHubへpushしたあと、GitHub Pagesの公開元をこのリポジトリのルートに設定します。

公開URLは次のとおりです。

```text
https://mei-chan-nel.github.io/info1-quiz-app/
```
