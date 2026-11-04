# ローカル管理画面

`admin.html` は、唯一の正本 `data/dictionary-data.json` を編集するための静的管理画面です。

## できること
- 英語タグ・日本語訳・大分類・小分類・詳細・別名を編集
- 翻訳・分類の確認状態、修正理由、出典を編集
- 変更差分を確認
- プロンプト出力カテゴリ順を並べ替え
- 編集内容をブラウザのローカルストレージに一時保存
- 正本JSONを1ファイルで出力

## 制約
- 認証・アクセス制御はありません。秘密情報やトークンを入力しないでください。
- 編集内容はブラウザ内に保存され、GitHubへ自動送信されません。
- 出力した `dictionary-data.json` をリポジトリへ反映する前に検証してください。
- タグ行の順序はレビュー情報のインデックスと対応しています。タグ行の並べ替え・追加・削除を手作業で行わないでください。

## 操作手順
1. `admin.html` を開き、タグを検索して選択します。
2. 必要な項目を編集し、差分を確認して「変更を保存」します。
3. 出力カテゴリ順を変える場合は上下ボタンで並べ替えます。
4. 「正本JSONを出力」で `dictionary-data.json` を出力します。
5. リポジトリのルートで次を実行して検証します。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data.json --check
```

6. 検証が通った場合のみ、正本へ反映します。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data.json --write
node scripts/build-dictionary-data.mjs --check
node scripts/audit-tags.mjs
node scripts/audit-tag-management.mjs
```

変更はPRで確認してください。変更履歴はGitのコミット履歴で追跡し、別の変更履歴JSONは作成しません。
