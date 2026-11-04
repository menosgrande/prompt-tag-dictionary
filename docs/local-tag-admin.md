# ローカルタグ管理

`admin.html` はタグ辞典の編集用画面です。GitHub Pages上ではローカル編集として動作し、GitHubへ直接書き込みません。

## できること

- 英語タグ名・日本語訳・大分類・小分類・詳細分類・別名の編集
- 翻訳状態・分類状態・修正理由・出典の記録
- 検索、状態フィルター、並び替え
- プロンプト出力カテゴリ順の調整
- ブラウザ内の一時保存・復元
- 正本と変更履歴を含む一括エクスポート

## データの扱い

タグ、分類候補、レビュー状態、分類体系、出力順、タググループ、NSFW確認候補は `data/dictionary-data.json` に集約されています。管理画面はこの正本と追記専用の `data/tag-change-log.json` だけを読み込みます。

管理画面のレビュー状態をタグメタデータへ二重書き込みしません。レビュー状態は正本の `reviews` に格納し、変更履歴は `tag-change-log.json` に追記します。

## 公開データへの反映

1. GitHub Pagesで `admin.html` を開く。
2. 編集内容を保存する。
3. 「正本・変更履歴を一括エクスポート」で `dictionary-data-update.json` を保存する。
4. リポジトリの作業環境で実行する。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data-update.json --check
```

5. 検証が成功した場合だけ `--write` を付けて反映する。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data-update.json --write
node scripts/build-dictionary-data.mjs --check
```

適用処理は正本と変更履歴の2ファイルだけを更新します。旧 `tags.json`、確認台帳、分類体系JSON、出力順JSONを再生成しません。エクスポート後に正本が更新されていた場合は、フィンガープリント不一致で適用を拒否します。

## 注意

- `?admin=1` は認証・アクセス制御ではありません。
- ブラウザ内の一時編集は、その端末の保存領域に保持されます。
- エクスポート前の編集は、ブラウザデータ消去で失われる可能性があります。
- タグの新規追加・削除は管理画面では行いません。
- 確認状態を `verified` にする場合は、訳語・分類の根拠を実際に確認してください。
