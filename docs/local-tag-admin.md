# ローカル管理画面

`admin.html` は、唯一の正本 `data/dictionary-data.json` を編集するための静的管理画面です。通常のWeb辞典画面とは別の管理用ページです。

## できること

- 英語タグ・日本語訳・大分類・小分類・詳細・別名の編集
- 翻訳・分類の確認状態、修正理由、出典の編集
- 表現レベル（0〜4）と判定根拠の編集
- 変更差分の確認
- プロンプト出力カテゴリ順の並べ替え
- 編集内容のブラウザ内一時保存
- 正本JSONのエクスポート

## 保存と安全上の制約

- 認証・アクセス制御はありません。公開環境で秘密情報やトークンを入力しないでください。
- 編集中の内容はブラウザのローカルストレージに保存されます。GitHubへ自動送信されません。
- エクスポート前の編集は、そのブラウザのデータ消去などで失われる可能性があります。作業区切りごとにJSONを出力してください。
- エクスポートファイルは正本の完全なスナップショットです。古いJSONを最新の正本へ上書きしないでください。
- タグ名を変更すると、管理画面は分類候補・NSFW候補・出力順上書き・タググループ内の参照も更新します。ただし、エクスポート後に必ず差分と参照整合性を確認してください。
- タグの追加・削除・並べ替えは通常の翻訳・分類編集とは別作業です。CSVの行照合にも影響するため、個別に監査してください。

## 操作手順

1. 最新のリポジトリから `data/dictionary-data.json` を取得し、管理画面が読み込む正本を最新状態にします。
2. `admin.html` を開き、タグを検索して選択します。
3. 必要な項目を編集し、差分を確認して「変更を保存」します。
4. 出力カテゴリ順を変更する場合は上下ボタンで並べ替えます。
5. 「正本JSONを出力」で `dictionary-data.json` を出力します。
6. リポジトリのルートで、出力ファイルを検証します。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data.json --check
```

7. 検証が通り、変更差分が意図どおりであることを確認した場合だけ正本へ反映します。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data.json --write
node scripts/build-dictionary-data.mjs --check
node scripts/audit-tags.mjs
node scripts/audit-tag-management.mjs
node scripts/audit-prompt-order.mjs
node scripts/audit-tag-groups.mjs
```

8. 変更をコミットする前に、正本JSONの差分・タグ件数・対象外データ・候補情報・参照整合性を確認します。可能な範囲で関連テストも実行してください。

## 正本の構造

- 正本は `data/dictionary-data.json` の1ファイルです。
- レビュー状態はタグ行のメタデータに保持されます。タグ配列の位置に依存する別のpacked review indexを正本として使いません。
- 分類体系・出力順・タググループ・候補情報も正本内で管理されます。
- CSVは一括編集用の入出力形式であり、正本ではありません。CSV経由の編集は `docs/DATA_MAINTENANCE_POLICY.md` の手順に従ってください。

運用ルールの正式な基準は [データ整備・運用の正式方針](DATA_MAINTENANCE_POLICY.md) です。
