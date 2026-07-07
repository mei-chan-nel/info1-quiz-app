# 情報I 知識問題トレーニング

共通テスト「情報I」の第1問・第2問で問われる知識問題と基本計算問題を練習するためのWebアプリです。

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

ただし、静的ホスティングでは `/api/results` と `/api/stats` が動かないため、次の機能は永続保存されません。

- 他の人がどの選択肢を選んだかの集計
- 良問・悪問・範囲外の報告

これらを公開環境で保存するには、`scripts/quiz_server.py` 相当のAPIを動かせる環境、または Supabase / Firebase / Cloudflare Workers などの外部DB/APIへ置き換える必要があります。

## GitHub Pagesで試験公開する場合

リポジトリをGitHubへpushしたあと、GitHub Pagesの公開元をこのリポジトリのルートに設定します。

公開URLは通常、次のような形になります。

```text
https://<user-name>.github.io/<repository-name>/app/
```

## 集計データ

`data/questions/choice_stats.json` は初期状態では空です。

ローカルサーバで使うと、回答結果や問題評価がこのファイルへ保存されます。

