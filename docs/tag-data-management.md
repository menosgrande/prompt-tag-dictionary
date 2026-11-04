# タグデータ管理仕様

## 正規データの役割

公開辞典と管理画面が参照するタグ・分類・翻訳・確認状態の正本は、`data/dictionary-data.json` です。旧 `data/tags.json` は使用しません。

| ファイル | 役割 |
|---|---|
| `data/dictionary-data.json` | 唯一の辞典正本。タグ、分類体系、出力順、分類候補、管理画面レビュー、タググループ、NSFW確認候補を保持 |
| `data/tag-change-log.json` | 追記専用の変更履歴。既存レコードの削除・書き換えは禁止 |
| `src/admin.js` | 正本と変更履歴を読み、ブラウザ内で編集・一時保存・一括エクスポート |
| `scripts/apply-admin-export.mjs` | 一括エクスポートを検証し、正本と変更履歴だけを更新 |
| `scripts/build-dictionary-data.mjs --check` | 正本の構造・レビュー状態・分類順を検証する。生成・書き換えは行わない |

分類体系、出力順、タググループ、NSFW確認候補の独立JSONは正本と内容が重複するため使用しません。正本と完全一致する旧ファイルは依存関係を外した後に削除します。

## タグ行

タグ行は次の配列形式です。

- 基本: `[tag, ja, major, minor]`
- 詳細情報あり: `[tag, ja, major, minor, detail, aliases, metadata]`

`metadata.translation` は翻訳候補の状態、`metadata.classification` は意味分類候補の状態を保持します。候補の状態と管理画面で人が確認した状態は別概念です。候補が存在するだけで確認済みとは扱いません。

## 管理画面レビュー

人手確認の状態は正本トップレベルの `reviews` に格納します。タグ名をキーにし、値は次の5項目配列です。

`[translationStatusCode, classificationStatusCode, reviewedAt, noteIndex, sourceIndex]`

状態コードは `reviews.statusCodes`、注記と出典の重複文字列は `reviews.notes` と `reviews.sources` に保持します。これにより、レビュー状態をタグメタデータや別の確認台帳へ二重書き込みしません。

翻訳状態:
- `unreviewed`: 未確認
- `needs-review`: 要確認
- `verified`: 人手確認済み
- `machine-translation`: 機械翻訳
- `not-applicable`: 対象外

分類状態:
- `unreviewed`: 未確認
- `provisional`: 暫定候補
- `needs-review`: 要確認
- `verified`: 人手確認済み
- `not-applicable`: 対象外

レビュー状態は翻訳・分類の内容が正しいことを自動的に保証しません。確認者が実際に根拠を確認した場合のみ `verified` にします。

## 変更履歴

`data/tag-change-log.json` は管理画面で保存した変更を追記します。各レコードは対象タグ、日付、変更フィールド、変更前後、理由、出典を保持します。

- 既存レコードは削除・編集しない。
- 訂正が必要な場合は新しい訂正記録を追加する。
- 一括エクスポート適用時に既存履歴が完全な接頭辞として残っていることを検証する。
- 現行タグ一覧にない過去タグの履歴も監査記録として保持する。

## 管理画面からの反映

1. GitHub Pages の `admin.html` を開く。
2. タグの訳語・分類・確認状態を編集する。出力カテゴリ順も必要に応じて変更する。
3. 「正本・変更履歴を一括エクスポート」を押し、`dictionary-data-update.json` を保存する。
4. リポジトリの作業環境で検証する。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data-update.json --check
```

5. 検証が成功した場合だけ反映する。

```sh
node scripts/apply-admin-export.mjs --input dictionary-data-update.json --write
node scripts/build-dictionary-data.mjs --check
```

エクスポート時点の正本フィンガープリントが現在のデータと異なる場合、古いエクスポートによる上書きを拒否します。タグの追加・削除は管理画面の対象外であり、別途レビューしたデータ移行として実施します。

## 自動監査の範囲

CIは以下を確認します。

- 正本JSONのスキーマとタグ行形式
- 正規化後のタグ重複
- 大分類・小分類が正規分類体系に属すること
- 管理画面レビューの参照先・状態コード・注記/出典インデックス
- 17分類とプロンプト出力順の一致
- 変更履歴の構造
- 翻訳候補・タググループ・UI統合テスト

自動監査は訳語や意味分類の正しさを全件保証しません。翻訳・分類の意味的な精査は別工程です。
