# 学習アプリのGA4独自イベント

学習アプリは、サイト共通の `assets/site-header.js` が用意する `window.gtag` を利用する。アプリ内でGA4タグ本体は追加しない。`window.gtag` がない環境では、イベント送信を行わず通常どおり動作する。

GA4のキーイベントとして設定するのは `quiz_answer` だけである。その他は通常イベントとして扱う。

## イベント仕様

| イベント名 | 発火条件 | パラメータ |
| --- | --- | --- |
| `quiz_answer` | 通常演習または誤答復習で回答が確定したとき | `learning_context`, `question_field`, `answer_mode`, `calc_mode`, `session_target`, `question_position` |
| `ai_help_click` | ChatGPTのヒントまたは解説を開くとき | `help_type`, `surface`, `learning_context`, `question_field` |
| `learning_record_view` | 開始画面、結果画面、メニュー、または直接URLから学習記録へ入ったとき | `entry_point` |
| `review_list_view` | 学習記録から誤答・保存・解答済みの一覧を開いたとき | `list_type` |
| `review_question_open` | 復習一覧から個別の問題を開いたとき | `list_type`, `review_mode` |
| `question_bookmark` | 問題の保存状態を変更したとき | `bookmark_action`, `surface` |
| `result_share_click` | 結果をXへ投稿するボタンを押したとき | `share_target` |
| `similar_button_click` | 類題ボタンのクリックを受け付け、二重押下防止状態へ移行した直後 | `source_screen`, `source_question_id` |

`session_target` と `question_position` 以外は、仕様で定めた固定的で低カーディナリティな値だけを送る。

## プライバシー

問題文、選択肢、利用者が選んだ回答、正誤、正解、得点、正解数、正答率、累計成績、回答履歴、連続学習日数、ローカルストレージの内容、Supabaseへ送る回答データ、不備報告の内容はGA4へ送信しない。問題IDは `similar_button_click` の `source_question_id` として、類題の基準IDだけを送信する。

ChatGPTのプロンプトと完全なURL、Xの投稿文と完全な投稿URLもGA4へ送信しない。ChatGPTとXの操作要素はリンクではなくボタンとし、外部URLはクリック時にだけ生成して新しいタブで開く。これにより、GA4の自動離脱クリックが完全な外部URLを収集することを避ける。

## GA4管理画面で必要な設定

次の作業はGA4管理画面で手動実施する。

1. `quiz_answer` をキーイベントに設定する。
2. 次の15個をイベントスコープのカスタムディメンションとして登録する。
   `learning_context`, `question_field`, `answer_mode`, `calc_mode`, `help_type`, `surface`, `entry_point`, `list_type`, `review_mode`, `bookmark_action`, `share_target`, `session_target`, `question_position`, `source_screen`, `source_question_id`
3. DebugViewまたはリアルタイムレポートで、イベント名と各パラメータが意図どおり届くことを確認する。

`session_target` と `question_position` のイベントパラメータ値は数値だが、設定区分と到達位置の分類に使うため、カスタム指標ではなくイベントスコープのカスタムディメンションとして扱う。全回答数は `quiz_answer` のイベント数で集計する。
