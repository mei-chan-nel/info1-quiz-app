# 情報I 知識問題トレーニング

共通テスト「情報I」の第1問・第2問で問われる知識問題と基本計算問題を練習するためのWebアプリです。

## 問題について

本アプリの問題には、IPAが公開している情報処理技術者試験等の公開問題を参考にして独自に改題・再構成したものが含まれます。

各問題の出典情報は、問題データ内の `source_display` および `source_question_ids` に記録しています。

本アプリはIPAおよび大学入試センターの公式サービスではありません。

## フォルダ構成

```text
app/
  index.html
  app.js
  styles.css
data/questions/
  completed_questions.json
  choice_stats.json
scripts/
  quiz_server.py
```

## ローカルで動かす

Python 3が入っている環境で、リポジトリのルートから次を実行します。

```powershell
python scripts/quiz_server.py --host 127.0.0.1 --port 8765
```

ブラウザで次を開きます。

```text
http://127.0.0.1:8765/app/
```

`start_local_server.bat` をダブルクリックして起動することもできます。

## 公開について

GitHub Pagesなどの静的ホスティングでも、問題表示・解答・結果表示は動きます。
選択肢の集計と範囲外報告は、ブラウザからSupabaseのRPCを呼び出して保存します。

フロントエンドに置くのはSupabaseのPublishable keyのみです。secret key、service_role key、データベースパスワード、接続文字列は使用せず、リポジトリにも含めません。

## GitHub Pagesで試験公開する場合

リポジトリをGitHubへpushしたあと、GitHub Pagesの公開元をこのリポジトリのルートに設定します。

公開URLは通常、次のような形になります。

```text
https://<user-name>.github.io/<repository-name>/app/
```

## 集計データ

`data/questions/choice_stats.json` は旧ローカル集計用のデータです。公開版を含む現在のアプリでは、Supabaseに集計を保存します。
