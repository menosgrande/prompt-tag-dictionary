# 新タグJSONスキーマ案 v1

更新日：2026-11-03  
状態：実装前の仕様案。フィールドとファイル構成のレビュー用。

## 設計方針
- 旧4列配列を引き継がず、意味・分類・翻訳・検索補助・管理属性を明示する。
- タグの意味分類は1件につき1つ。横断属性をカテゴリへ混ぜない。
- 色語を属性として保存しない。色だけが修飾する複合タグは基本語に正規化する。
- 未確認の翻訳・分類・出力先・レーティングを確定値として捏造しない。
- 初期実装に必要なデータだけを必須化し、説明や関連語は段階的に補完する。
- UIのカテゴリ順はcategories.jsonを唯一の正とする。

## ファイル構成案
| ファイル | 内容 | 必須度 |
|---|---|---|
| data/categories.json | 大分類・小分類・表示順・分類説明 | 必須 |
| data/tags.json | 正規タグ本体 | 必須 |
| data/sources.json | 出典・ライセンス・参照情報 | 必須 |
| data/tag-relations.json | 上位・下位・関連語 | 任意。必要になってから追加 |

同義語・表記揺れはタグ本体のaliasesに集約し、別タグとして出力しない。tag-relationsには同義語を重複登録しない。

## categories.json
各カテゴリはid、nameJa、nameEn、description、order、subcategoriesを持つ。小分類はid、nameJa、nameEn、descriptionを持つ。
- idは英小文字ケバブケースで作成後は原則変更しない。
- orderは重複しない整数。UI表示順とプロンプト出力順で共用する。
- 小分類が不要なタグはsubcategoryIdをnullにする。
- カテゴリ統合・削除時はタグの再割当てを監査する。

## tags.json：推奨レコード
```json
{
  "id": "tag-000001",
  "tag": "long hair",
  "ja": "長髪",
  "categoryId": "hair-head",
  "subcategoryId": "hair-length",
  "aliases": [],
  "keywords": ["長い髪"],
  "definition": "髪が長く伸びている状態。",
  "usageNotes": "",
  "promptTarget": "positive",
  "rating": "general",
  "reviewStatus": "provisional",
  "sourceIds": ["source-legacy-001"]
}
```

### フィールド定義
| フィールド | 型 | 必須 | 用途 |
|---|---|---:|---|
| id | string | 必須 | 不変の内部ID。タグ名変更後も維持する。 |
| tag | string | 必須 | 英語の正規タグ。前後空白なし。 |
| ja | string | 必須 | 短い日本語表示名。未確認訳を確定扱いしない。 |
| categoryId | string | 必須 | 大分類IDを1つ指定。 |
| subcategoryId | string/null | 必須 | 小分類IDまたはnull。 |
| aliases | string[] | 必須 | 同義語・表記揺れ。プロンプトには出力しない。 |
| keywords | string[] | 必須 | 英日検索の補助語。 |
| definition | string | 任意 | 意味と適用条件。 |
| usageNotes | string | 任意 | 誤用・モデル差・適用範囲の注意。 |
| promptTarget | enum | 必須 | positive / negative / both / none。 |
| rating | enum | 必須 | general / mature / explicit。 |
| reviewStatus | enum | 必須 | verified / provisional / needs_review。 |
| sourceIds | string[] | 必須 | sources.jsonへの参照。出典不明なら空配列。 |

### 属性の運用
- promptTarget=positive：通常の描写指定。
- promptTarget=negative：除外・抑制したい描写。
- promptTarget=both：用法により両方で使う。
- promptTarget=none：検索・説明専用。
- ratingは表示制御用。general / mature / explicitを候補とし、意味分類・出力先とは独立させる。
- reviewStatus=verifiedは英語タグ、訳、分類、出力先、レーティングを確認済み。
- reviewStatus=provisionalは旧データ由来など未確認項目が残る状態。
- reviewStatus=needs_reviewは意味・訳・分類などに不確実性があり、確定データとして扱わない状態。
- needs_reviewはプロンプト自動出力の対象外とする。

## sources.json
出典レコードはid、name、url、sourceType、accessedAt、license、redistribution、notesを持つ。ライセンス未確認はunknown、再配布可否未確認もunknownとする。旧データの出典が不明な場合、有名データベースを出典として後付けしない。参照した資料と、実際にタグを取得したデータソースを区別する。

## tag-relations.json（任意）
必要になった場合のみfromTagId、relation、toTagIdを持つレコードを作る。relationはbroader / narrower / related。方向の定義を実装時に固定し、同じ関係を逆向きに二重登録しない。同義語はaliasesで管理する。

## 旧データからの移行ルール
1. 旧レコードは変更せずバックアップとして保持する。
2. 英語タグの重複候補を抽出する。空白・大文字小文字・アンダースコアの差を意味確認なしに同一視しない。
3. 色語だけが修飾するタグは基本語へ統合し、色属性や色付き別名は作らない。
4. 色を除くと意味が変わる既成語・固有名詞・食品名・動植物名・模様名・素材名は原形維持候補として確認する。
5. 旧カテゴリを新categoryIdへ対応付ける。未分類・その他は自動で恒久カテゴリに割り当てない。
6. 既存訳は暫定保持するが、明らかな誤訳・意味不一致はレビュー対象にする。
7. 旧データにない説明・別名・出力先・レーティングを推測で埋めない。暫定値にはprovisionalまたはneeds_reviewを付ける。
8. 旧データと新データの対応表を保持し、移行後も元レコードへ追跡可能にする。

## 実装前の検証条件
- JSONとしてパース可能。
- 全tag.idが一意。正規tagの重複候補は移行前に解消。
- categoryIdがcategories.jsonに存在し、subcategoryIdは指定カテゴリ配下に存在する。
- promptTarget / rating / reviewStatusが定義済みenumに一致する。
- sourceIdsがすべてsources.jsonに存在する。
- category orderが一意かつ連番。
- aliasが他タグの正規tagと衝突する場合はレビュー対象。
- needs_reviewは確定データとしてプロンプト自動出力しない。

## 未決事項
- 日本語訳が未確定の場合の表現方法。
- definition / usageNotesを初期移行時にどこまで埋めるか。
- ratingの判定ガイドラインと境界例。
- promptTargetの初期分類をどこまで自動化するか。
- 旧タグ10,988件のID付与・重複統合・翻訳監査の順序。
- 出典不明データをどの範囲まで公開・再配布できるか。

この仕様は実装前の候補であり、未決事項を確定したものではない。データ生成とアプリ接続は、これらの項目を決定してから行う。