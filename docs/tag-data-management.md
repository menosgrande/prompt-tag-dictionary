# タグデータ管理ガイド

## 方針

- `data/tags.json` はアプリが直接読む互換データとして維持する。1行は `[tag, ja, major, minor]`。
- 大量のタグ本体をオブジェクト形式へ一括変換しない。現行アプリ・インポート処理との互換性を壊さず、まず管理情報を別ファイルに分離する。
- タグの意味や分類を自動で「正しい」と認定しない。ルールによる推定は仮分類として扱う。
- 過去の出典・翻訳者・確認履歴が残っていない既存行について、推測で履歴を作らない。
- タグの原文 `tag` は識別子として扱い、翻訳・分類修正時にも意図なく変更しない。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `data/tags.json` | アプリ用のタグ本体。4項目配列を維持 |
| `data/tag-review.json` | 人手で確認したタグだけを記録する確認台帳 |
| `data/tag-change-log.json` | これから行う変更の追記型履歴 |
| `data/sources.json` | データセット／入力ファイル単位の出典情報 |
| `scripts/audit-tags.mjs` | タグ本体の構造・分類・重複監査 |
| `scripts/audit-tag-management.mjs` | 確認台帳・変更履歴とタグ本体の整合性監査 |

## 確認台帳の使い方

`data/tag-review.json` の `entries` に、実際に確認したタグだけを追加する。キーは `data/tags.json` の英語タグ文字列とする。

- `translationStatus`: `unreviewed` / `needs-review` / `machine-translation` / `verified` / `not-applicable`
- `classificationStatus`: `unreviewed` / `provisional` / `needs-review` / `verified` / `not-applicable`
- `reviewedAt`: 確認した日付（`YYYY-MM-DD`）
- `reviewer`: 確認者（任意。個人名を公開したくない場合は役割名でよい）
- `note`: 判断根拠や残課題（任意）
- `source`: 実際に確認に使った出典URLまたは識別子（任意）

状態の意味は次のとおり。

- `unreviewed`: 未確認。品質が低いと断定する意味ではない。
- `needs-review`: 問題候補があり、再確認が必要。
- `machine-translation`: 機械翻訳由来と確認できている。
- `provisional`: 分類は付いているが、推定・暫定。
- `verified`: 指定した観点を人が確認済み。タグ全体の正しさを保証するものではない。
- `not-applicable`: その観点が適用されない。

台帳に存在しないタグは「未確認」と解釈する。11,000件すべてに同じ状態を複製する必要はない。

## 変更履歴の記録

タグ本体の訳語・分類を変更したら、`data/tag-change-log.json` の `changes` に記録を追記する。過去の記録は削除・書き換えず、誤記は訂正記録を追加する。

各記録には以下を含める。

- `tag`: 対象の英語タグ
- `changedAt`: 変更日（`YYYY-MM-DD`）
- `fields`: 変更した項目名の配列（`ja`, `major`, `minor` など）
- `before` / `after`: 変更前後の値
- `reason`: 変更理由
- `source`: 根拠にした出典。ない場合は `null` とし、推測しない。

Gitのコミット履歴も変更履歴として残るが、タグ単位で検索・集計しやすくするため、この台帳も併用する。履歴記録は人手で追記する運用であり、現時点で自動生成はしない。

## 安全な修正手順

1. 対象タグが `data/tags.json` に存在することを確認する。
2. 原文タグ・既存訳・分類を確認し、根拠を用意する。
3. 必要なフィールドだけ修正する。無関係な一括置換をしない。
4. 変更履歴を追記し、確認した場合は確認台帳も更新する。
5. `node scripts/audit-tags.mjs` と `node scripts/audit-tag-management.mjs` を実行する。
6. 差分を確認し、タグ数・未分類数・未翻訳数に意図しない変化がないことを確認してからPRを作成する。

## 監査の範囲

自動監査はJSON構造、既存タグへの参照、状態値、日付形式、変更履歴の必須項目を確認する。日本語訳や意味上の分類が正しいかは自動判定できない。確認台帳に登録しただけで内容が正しいと保証されるわけではない。
