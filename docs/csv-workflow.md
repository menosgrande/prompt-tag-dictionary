# CSVで辞典を編集する

`exports/dictionary-working.csv` は、正本 `data/dictionary-data.json` を表計算ソフトで編集するための作業用CSVです。CSV自体を正本にはしません。

## 編集できる列

| 列 | 編集内容 |
|---|---|
| `ja` | 日本語訳 |
| `major` | 大分類 |
| `minor` | 小分類 |
| `detail` | 詳細・補足 |
| `aliases_json` | 別名。JSON配列で入力（例：`["alias one","alias two"]`） |
| `translation_status` | `verified` / `needs-review` / `unreviewed` |
| `expression_level` | 表現レベル0〜4。空欄は未設定 |
| `expression_level_review_status` | 表現レベルの確認状態 |
| `classification_review_status` | 分類の確認状態 |

`index` と `tag` は行の照合に使うため変更しないでください。並べ替え、行の追加・削除も禁止です。`metadata_json` と `review_json` は確認用の読み取り専用列です。これらを編集しても正本には反映しません。

## 更新手順

1. `exports/dictionary-working.csv` をダウンロードし、Excelなどで編集します。
2. CSV形式（UTF-8）で保存します。列名・列数・全行を維持してください。
3. GitHub上で同じパス `exports/dictionary-working.csv` のファイルを置き換えて `main` にコミットします。
4. GitHub Actions の「Import dictionary CSV」が自動実行されます。
5. 成功すると、変更列だけが `data/dictionary-data.json` に反映され、CSVも最新の正本から再生成されます。

## 安全策

- CSVの全行数と各行の `index` / `tag` が正本と一致しない場合、処理を中止します。
- JSONとして不正な別名、許可されていない状態値、0〜4以外の表現レベルがあれば処理を中止します。
- 正本のメタデータ・レビュー記録は、対応する編集列以外から上書きしません。
- インポート後に辞典構造チェックとタグ・分類監査を実行します。失敗した場合、正本JSONの更新コミットは行われません。
- GitHub Actionsが成功したことを確認してから次の編集に進んでください。失敗した場合はCSVを直し、再コミットしてください。

一度に全件を編集する必要はありません。フィルターや検索で対象を絞り、編集後も全行を残したまま保存してください。
