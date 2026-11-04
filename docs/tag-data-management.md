# タグデータ管理ガイド

## 唯一の正本

タグ・翻訳・分類・説明・確認状態・分類体系・出力順・グループ・分類調査候補・外部プロンプト候補・出典情報は、すべて `data/dictionary-data.json` に集約します。辞書データを分割した補助JSONを別の正本として扱いません。

## データ構造

- `tags`: タグ本体。通常は `[tag, ja, major, minor]`、詳細情報がある行は `[tag, ja, major, minor, detail, aliases, metadata]`。
- `metadata.translation`: 翻訳状態、候補訳、出典など。
- `metadata.classification`: 分類候補。
- `metadata.classificationReview`: 分類の確認状態、理由、出典。
- `review`: 翻訳・分類レビュー状態をタグ配列のインデックスに対応させて格納するコンパクトな索引。タグ行の順序を変える場合は必ず索引も同時に移行する。
- `taxonomy` / `promptOrder`: 分類体系とプロンプト出力順。
- `classificationCandidates`: タグ行の分類メタデータと同期する索引。
- `classificationResearch`: 色分類・分類レビュー・ローマ字名監査などの候補と根拠。
- `externalPromptCandidates`: 外部資料から得た追加候補。既存タグと新規候補を区別し、確定タグと混同しない。
- `sourceInfo`: データセットの出典・取得情報・制約。

## 状態の意味

- `unreviewed`: 未確認。誤りと断定する意味ではない。
- `needs-review`: 再確認が必要。
- `machine-translation`: 機械翻訳由来。
- `provisional`: 仮分類。確定分類ではない。
- `verified`: 指定した観点を確認済み。タグ全体の正しさを保証するものではない。
- `not-applicable`: その確認観点が適用されない。

確認状態は原文や分類候補の意味を自動的に確定しません。出典が不明な場合は推測で補わず、未確認のまま保持します。

## 変更履歴

変更履歴はGitのコミット履歴で追跡します。別の変更履歴JSONは作成しません。タグ単位の説明・根拠・出典として必要な情報は、該当タグのメタデータに保持します。

## 安全な修正手順

1. 対象タグが正本に存在することを確認します。
2. 英語タグ原文・日本語訳・分類・既存メタデータを確認します。
3. 必要なフィールドだけ変更します。無関係な一括置換はしません。
4. 管理画面から正本JSONを出力します。
5. `node scripts/apply-admin-export.mjs --input dictionary-data.json --check` で検証します。
6. 検証後に正本へ反映し、以下を実行します。

```sh
node scripts/build-dictionary-data.mjs --check
node scripts/audit-tags.mjs
node scripts/audit-taxonomy.mjs
node scripts/audit-prompt-order.mjs
node scripts/audit-tag-management.mjs
node scripts/audit-translations.mjs
node scripts/audit-tag-groups.mjs
```

7. 差分とCIを確認し、PRで反映します。

## 注意

レビュー索引は `tags` の配列順と対応しています。タグの順序変更・追加・削除を行う処理は、レビュー索引、分類候補索引、タググループなどへの参照を同期して更新する必要があります。正本を更新できない場合は、途中状態のJSONで上書きせず処理を中止してください。
