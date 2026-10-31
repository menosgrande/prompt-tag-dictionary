# データ出典・ライセンス監査（2026-10-31）

## 確認できたこと

- boorutan/booru-japanese-tag は上流READMEにMIT Licenseの記載があり、LICENSEファイルもリポジトリ内に存在する。翻訳データには手作業訳と機械翻訳の両方が含まれる。https://github.com/boorutan/booru-japanese-tag
- PYU224/tagdb-updater はDanbooru公開APIとwikiの別名を利用し、翻訳CSVには機械翻訳が含まれると上流READMEに説明がある。ただし今回の確認では、上流のライセンス許諾を独立して確認できなかった。https://github.com/PYU224/tagdb-updater
- menosgrande/prompt-tag-dictionary のリポジトリルートには、2026-10-31時点でLICENSEファイルが存在しない。
- tags-full.json、tags-ja-progress.json、Perchance由来ソースの元URL・取得日・改訂番号は復元できていない。

## 現時点の扱い

| データ | ライセンス確認 | 扱い |
|---|---|---|
| boorutan翻訳データ | 上流はMITを宣言 | 上流ライセンスの範囲と元データの権利を分けて確認 |
| PYU224翻訳データ | 未確認 | MITと断定しない。再配布条件は保留 |
| 元タグ一覧 | 不明 | 出典・取得日・条件を推測しない |
| Perchance由来データ | 不明 | 元ソースと条件を確認できるまで保留 |
| 本リポジトリのコード・データ | LICENSEなし | 公開状態だけで再利用許諾があると扱わない |

## 残作業

- [ ] PYU224上流のLICENSEファイルまたは作者の明示的な許諾を確認
- [ ] tags-full.json の元ファイル・取得元・取得日を特定
- [ ] tags-ja-progress.json の元ファイル・取得元・取得日を特定
- [ ] Perchance由来のソースJavaScript/textの取得元と利用条件を特定
- [ ] Danbooru由来データの利用条件を個別に確認
- [ ] 本リポジトリのコード用LICENSEを選択する（ユーザー判断が必要）
- [ ] コードライセンスとタグデータの利用条件を混同しない形でREADMEを整備

## 注意

この監査は法律意見ではない。ライセンスが確認できないデータを削除したり、利用可能と断定したりせず、確認できない点を明示している。