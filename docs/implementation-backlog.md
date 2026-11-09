# 実装状況・保留項目

最終更新: 2026-11-09（翻訳・分類レビュー継続中）

この文書は、現行リポジトリに残っているデータ整備・管理運用・検証の未完了事項を管理する補助台帳です。データ管理の規範は [DATA_MAINTENANCE_POLICY.md](DATA_MAINTENANCE_POLICY.md) を唯一の正式ルールとします。

**注意:** ここに記載する件数は、必ず基準コミットと対象ファイルを併記します。過去の監査件数・旧ファイル構成・旧分類案を現在値として流用しません。通常画面・Web UIの改修は、このデータ整備バックログの対象外です。

## 現行データ構成

- 正本: `data/dictionary-data.json`
- CSV作業用ファイル: `exports/dictionary-working.csv`
- 管理画面: `admin.html` / `src/admin.js`
- 正本検証: `scripts/build-dictionary-data.mjs`
- タグ・分類監査: `scripts/audit-tags.mjs`
- taxonomy構造監査: `scripts/audit-taxonomy.mjs`
- 翻訳候補監査: `scripts/audit-translations.mjs`（診断専用。翻訳の正誤を自動確定しない）
- レビュー状態監査: `scripts/audit-tag-management.mjs`
- 出力順監査: `scripts/audit-prompt-order.mjs`
- タググループ監査: `scripts/audit-tag-groups.mjs`
- patch適用: `.github/scripts/apply-dictionary-patch.mjs`
- 旧NSFW候補診断: `scripts/build-tag-metadata-review.mjs`（現行参照と移行方針を再確認するまで削除保留）
- 管理画面エクスポート検証・反映: `scripts/apply-admin-export.mjs`

過去の分割JSONを正本として復活させない。派生ファイルや監査用ファイルは、現行コード・Actions・テストからの参照有無を確認してから扱う。

## 2026-11-09 時点の作業状況

### CSV整備と正本同期（2026-11-09）

- [x] 作業CSVの翻訳・分類・表現レベルを一巡確認し、明確な修正を反映。
- [x] 分類レビュー77件を確認。根拠不足の11件は `needs-review` を維持。
- [x] CSV変更をPR #121でmainへ反映。
- [x] CSVインポートActions run [42592369821](https://github.com/menosgrande/prompt-tag-dictionary/actions/runs/42592369821) 成功。
- [x] 10,995行を照合し、1,880タグ行を正本JSONへ反映。
- [x] インポート後の正本構造・taxonomy・タグ・レビュー状態・翻訳候補・出力順・タググループ監査が成功。
- [x] CSVインポート専用テスト12件、全Nodeテスト44件が成功。
- [x] Actionsが正本JSONとCSVをペア更新し、正本JSONをコミット `679ae829192807149180aa61a836a9a516e0767e` でmainへ反映。

変更内訳: 日本語訳10、大分類319、小分類451、別名3、翻訳状態14、表現レベル18、表現レベル確認18、分類確認状態1,860。変更タグ行数とフィールド変更数は異なるため合算しない。

### 最新レビュー進捗スナップショット（2026-11-09）

- 基準main commit: `1ec6b81e8c5fa0dae6660dbf4a6a0e149a2eb711`
- 正本Blob SHA: `71b59ff5ba7835619c7a8cb659663913319507d0`
- CSV Blob SHA: `55cf5e64a8ff6ac33a0a9587cf64b5f388281b9b`
- タグ数: 10,995件
- 翻訳状態: verified 7,955 / needs-review 1,104 / unreviewed 1,931 / machine-translation 5
- 分類レビュー状態: verified 3,966 / unreviewed 6,100 / provisional 895 / needs-review 34
- 未分類（Parenthetical tags監査）: 0件

今回の継続レビューで、翻訳72件をverifiedへ更新し、分類74件のレビュー状態を更新。分類のうち25件は大分類・小分類も修正した。翻訳と分類の状態は独立しており、未処理件数を単純合算しない。

### 初回CSVインポート時のJSONスナップショット

- 基準コミット: `679ae829192807149180aa61a836a9a516e0767e`
- 正本Blob SHA: `abaeb4c34b78e812c84dee7330df118bccec26fd`
- CSV Blob SHA: `776fcec359ae62183d9e12e674e19555ec3b4c68`
- タグ数: 10,995件
- 翻訳状態: verified 7,883 / needs-review 1,125 / unreviewed 1,942 / machine-translation 45
- 分類レビュー状態: verified 3,892 / unreviewed 6,151 / provisional 918 / needs-review 34
- 未分類（Parenthetical tags監査）: 0件

これらはCSVインポート後のActionsログで確認した値。翻訳状態と分類レビュー状態は独立した集計であり、相互に合算しない。分類レビューの `needs-review` 34件すべてが、別途確認した11件の候補リストと同一という意味ではない。

## 実装済みとして確認できる仕組み

- [x] 辞書データを単一の正本JSONへ集約
- [x] タグ別メタデータに翻訳・分類レビュー状態を保持
- [x] 正本JSONのスキーマ・タグ行・重複・分類・翻訳候補・出力順の検証
- [x] 管理画面エクスポートの検証と正本への反映
- [x] タグ・taxonomy・翻訳候補・レビュー状態・出力順・タググループの監査スクリプト
- [x] CSVの行識別子・タグ名・列数・候補状態を照合するインポート処理
- [x] タググループと作品・キャラクター関連情報の正本内管理

ここでの「実装済み」はコードの存在を確認した意味であり、すべての操作を実ブラウザで検証済みという意味ではありません。

## 残タスク

### 正本・CSVの同期

- [x] 最新mainとの差分とCSVの全行照合を行う。
- [x] CSVインポート処理・構造検証・各種監査・NodeテストをGitHub Actionsで実行し、成功を確認。
- [x] CSVの意図した変更を正本JSONへ反映。
- [x] 正本JSONとCSVをActionsでペア更新。
- [x] インポート後の正本Blob SHA・CSV Blob SHA・タグ件数・レビュー状態を確認。

### 翻訳・分類・表現レベル

- [x] JSON正本へ反映後の状態を再集計し、CSV一巡作業後の最新レビュー状態を確認。
- [x] 機械翻訳扱い45件のうち40件を確認・verified化。残る5件（`bremerton (scorching-hot training) (azur lane)`, `caliburn (fate)`, `carton`, `charlotte (madoka magica)`, `choukai (kancolle)`）は固有名詞・語義の確認を継続。
- [x] 翻訳確認バッチで合計72件をverified化し、公式表記・語義の確認根拠をメタデータへ保存。
- [x] 分類レビュー74件を更新。明確なカテゴリ誤配置25件を既存の大分類・小分類へ修正。
- [ ] 翻訳の `needs-review` 1,104件・`unreviewed` 1,931件を、正本配列順で確認。明確な語から先に進め、固有名詞・多義語は出典が得られるまで保留。
- [ ] 分類の `unreviewed` 6,100件・`provisional` 895件を順に確認し、現行カテゴリで扱えるものは確定、誤配置は修正する。
- [ ] 分類 `needs-review` 34件は根拠を再調査し、確定できないものは要確認を維持する。
- [ ] 残る分類レビュー11件（`abuse`, `cloud print`, `paint`, `sadism`, `sanrio`, `shell`, `smell`, `snk`, `soviet`, `spiked shell`, `super robot`）は、根拠が得られた場合のみ確定する。
- [x] 翻訳・分類の未確認状態を独立して再集計する（上記最新スナップショット）。
- [ ] 表現レベルの未確認状態を独立して再集計し、タグ単体の意味に基づいて確認する。
- [ ] タグ名変更時に、正本内の分類候補・出力順上書き・タググループ等の全参照先が追従するか監査する。
- [ ] 旧NSFW監査データと表現レベルの移行関係を調査する。根拠のない一括変換・削除はしない。

### スクリプト・テスト・GitHub Actions

- [x] `node --test` をGitHub Actionsで実行し成功を確認（2026-11-08、run 42453796701）。
- [x] taxonomy監査・翻訳候補監査をデータ更新Actionsへ接続。
- [x] CSVインポートのJSON・CSVペア書き込みに一時ファイル・バックアップ・失敗時の復元処理を追加し、正常系・異常系をテスト。
- [x] patch適用スクリプトの入力検証と原子的な書き込みを強化し、関連テストを追加。
- [x] 今回のCSV実データ変更によるインポートActionsの実行確認（run 42592369821）。
- [ ] 古い監査文書・履歴資料の参照・記述を整理し、現行ルールとの混同を防ぐ。

## 完了報告の要件

各作業では次を記録します。

- 取得した正本のコミットまたはBlob SHA
- 対象範囲・対象件数
- 変更ファイルと変更内容
- タグ件数・未分類件数・各レビュー状態の変更前後
- 実行したテスト・監査コマンドと結果
- GitHub Actionsの実行状態（該当する場合）
- 未解決事項と保留理由

未実施のテストを成功扱いにしない。ブラウザ操作をしていない場合は、実ブラウザ確認済みと記載しない。
