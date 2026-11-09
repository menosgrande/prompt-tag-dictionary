# 実装状況・保留項目

最終更新: 2026-11-09

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

### CSV整備の一巡

- [x] 作業CSVの翻訳・分類・表現レベルを確認し、明確な修正を反映する一巡作業を実施（ユーザー確認）。
- [x] 直近の分類レビュー77件を確認。明確に確定できた項目を修正し、判断根拠が不足する11件は `needs-review` を維持。
- [x] 作業ブランチ: `work/csv-alias-audit-2026-11-09`
- [x] CSV更新コミット: `62cc80a6fe8f8987958d694beb1e0df8a55fea16`
- [ ] CSVの変更を正本JSONへ反映し、更新後の正本・メタデータ・件数を再検証する。
- [ ] CSVインポートActionsの成功ログと、JSON/CSVの同期を確認する。

このチェックはCSV上の一巡作業が行われたことを示します。全タグの意味・翻訳・分類が完全に確定したことや、CSV変更が正本JSONへ反映済みであることを意味しません。

### JSON正本の直近スナップショット（CSV作業ブランチとは区別）

- 基準: `main` の `db773da18edf16966df266160846c3929e8fafdf`（2026-11-09）
- 正本: `data/dictionary-data.json`
- 正本Blob SHA: `c207431e779f8ef8a95620bebd2918ab3b5dc4e1`
- タグ数: 10,995件
- 翻訳状態: verified 7,869 / needs-review 1,134 / unreviewed 1,946 / machine-translation 46
- 分類レビュー状態: verified 2,071 / unreviewed 7,058 / needs-review 921 / provisional 945

上記はmainのJSONを対象にした2026-11-09の棚卸し値です。作業ブランチのCSV反映後の値ではありません。翻訳・分類の状態は独立して集計されており、合算して総未処理数として扱わないでください。詳細は [辞書全体棚卸しレポート](dictionary-inventory-audit-2026-11-09.md) を参照してください。

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

- [ ] CSVインポートを実行する前に、最新mainとの差分とCSVの全行照合を行う。
- [ ] `node scripts/import-dictionary-csv.mjs --check` で非書き込み検証を行う。
- [ ] CSVの意図した変更だけが正本JSONへ反映されることを確認する。
- [ ] CSVとJSONのタグ件数・ID・英文タグ・配列順・メタデータ保持を照合する。
- [ ] GitHub Actionsの実行ログと最終コミットを記録する。

### 翻訳・分類・表現レベル

- [ ] JSON正本へ反映後の状態を再集計し、CSV一巡作業で残った未確認・要確認を切り分ける。
- [ ] 残る分類レビュー11件（`abuse`, `cloud print`, `paint`, `sadism`, `sanrio`, `shell`, `smell`, `snk`, `soviet`, `spiked shell`, `super robot`）は、根拠が得られた場合のみ確定する。
- [ ] 翻訳・分類・表現レベルの未確認状態をそれぞれ独立して再集計する。
- [ ] タグ名変更時に、正本内の分類候補・出力順上書き・タググループ等の全参照先が追従するか監査する。
- [ ] 旧NSFW監査データと表現レベルの移行関係を調査する。根拠のない一括変換・削除はしない。

### スクリプト・テスト・GitHub Actions

- [x] `node --test` をGitHub Actionsで実行し成功を確認（2026-11-08、run 42453796701）。
- [x] taxonomy監査・翻訳候補監査をデータ更新Actionsへ接続。
- [x] CSVインポートのJSON・CSVペア書き込みに一時ファイル・バックアップ・失敗時の復元処理を追加し、正常系・異常系をテスト。
- [x] patch適用スクリプトの入力検証と原子的な書き込みを強化し、関連テストを追加。
- [ ] 今回のCSV実データ変更によるインポートActionsの実行確認。
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
