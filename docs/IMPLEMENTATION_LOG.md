# 学習サイト改修記録

作業日: 2026-07-12

## 変更禁止範囲

既存学習アプリの表示・遷移・集計処理を変更しない方針とした。`app/` の全ファイルについて作業開始時のSHA-256を `docs/reports/app-baseline-sha256.json` に保存し、検証時に一致を確認する。

## 改修前の監査

- GitHub PagesのルートURLは404で、公開ページは `app/` だけだった。
- 問題データは861問あったが、`field_ids` は全問未設定だった。
- アプリ内の旧キーワード推定では792問に候補があり、69問は候補なしだった。
- 読むための問題一覧、分野ページ、ルートのサイトマップ、`ads.txt` はなかった。
- AdSenseコードはアプリ本体、アプリ内の案内ページ、プライバシーページにあった。

初回自己評価: **再審査不可**

## 第1段階: 分類

- `scripts/classify_questions.py` を追加した。
- 既存アプリの推定条件を再現し、792問の自動候補を作成した。
- 候補が出ない69問は問題内容、タグ、用語カテゴリを確認し、主分野を決定した。
- 全861問へ1件の `field_ids` を追加した。
- `data/questions/question.schema.json` で `field_ids` を新規問題の必須項目とした。
- 分類詳細を `docs/reports/field-classification.json`、69問の確認表を `docs/reports/field-classification-review.md` に保存した。

分類結果:

- 社会・セキュリティ: 321問
- デジタル表現: 189問
- ネットワーク: 146問
- データ活用・DB: 92問
- アルゴリズム: 74問
- 情報デザイン: 39問
- 未分類: 0問

## 第2段階: 学習コンテンツ生成

- `scripts/generate_site.py` を追加した。
- 問題一覧トップと6分野・32ページを生成した。
- 1ページは最大30問とし、全861問を重複なしで1回ずつ掲載した。
- 各問に問題文、選択肢、正答、解説、出典、タグを掲載した。
- ページごとに固有のtitle、description、canonical、h1、ページ移動を設定した。
- `sitemap.xml`、`robots.txt`、`ads.txt` を生成した。

## 第3段階: ポータルとデザイン

- ルートへ学習ポータルを追加し、404を解消した。
- ヘッダーに「問題一覧」と既存アプリへの導線を設けた。
- 6分野の説明、学習方法、問題作成方針、AI利用方針を掲載した。
- `assets/site.css` によるレスポンシブデザインを作成した。
- `about.html` と `privacy.html` をサイト側に追加し、運営者、問い合わせ、制作・改題・分類方針、データ取扱いを明示した。

## 第4段階: 広告範囲

- 新設した学習トップ、問題一覧トップ、32分野ページにAdSenseコードを設置した。
- 新設した案内ページとプライバシーページには広告コードを設置していない。
- 既存アプリファイルは変更しないため、`app/about.html` と `app/privacy.html` はAdSense管理画面でURL完全一致除外を設定する。
- アプリの操作領域除外とオーバーレイ抑制も、AdSense管理画面で行う。具体的な設定値は `docs/ADSENSE_CONFIGURATION.md` に記録した。

## 検証

`scripts/validate_site.py` で次を確認する。

- 全問に有効な主分野が1件ある
- 861問が生成ページに1回ずつ掲載される
- 1ページ30問以下
- title、description、canonical、h1の整合
- 内部リンク、アセット、フラグメントの存在
- 新設学習ページだけに広告コードがある
- 既存アプリの全ファイルが開始時ハッシュと一致する
- sitemap、robots.txt、ads.txtの構文と内容

実ブラウザではデスクトップと幅390px相当の表示を確認し、横スクロールなし、ヘッダー、ページ移動、問題カード、正答・解説の開閉を確認した。

検証結果は `docs/reports/validation.json` に保存する。

## 再生成手順

```powershell
python scripts/classify_questions.py --check
python scripts/generate_site.py
python scripts/validate_site.py
```

分類ルールを変更して問題データへ反映するときだけ、最初に `python scripts/classify_questions.py --apply` を実行する。
