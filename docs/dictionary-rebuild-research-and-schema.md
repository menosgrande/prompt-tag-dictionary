# 辞書再構築：外部資料調査メモとデータ設計案

更新日：2026-11-03  
状態：調査メモ／設計案（分類体系は未確定）

## 目的

既存の旧JSONをそのまま移植せず、画像生成用タグを「意味による分類」と「横断的な管理属性」に分けて再構築する。外部サイトの分類名をそのまま採用するのではなく、複数資料の共通点・相違点を確認し、当辞典の検索・選択・プロンプト出力に適した体系を設計する。

## 参照資料と読み取れること

### Danbooru

- [Howto:Tag](https://safebooru.donmai.us/wiki_pages/howto%3Atag)：画像に実際に見える要素をタグ付けする原則、主観的な評価語を避ける方針、一般タグと作品・キャラクター・作者などの固有名詞タグの区別を示す。
- [API:Tags](https://safebooru.donmai.us/wiki_pages/api%3Atags)：タグの基本情報として名称・カテゴリ・投稿数・廃止状態などを分離し、Wiki、別名、含意関係を関連情報として扱う。
- [API:Tag Aliases](https://safebooru.donmai.us/wiki_pages/api%3Atag_aliases)：同義・表記揺れを正規タグへ寄せる「別名」と、意味上の包含関係を示す「含意」を区別する。
- [API:Tag Implications](https://safebooru.donmai.us/wiki_pages/api%3Atag_implications)：タグ間の包含・付随関係を別の関係データとして保持する。
- [Howto:Tag Checklist](https://safebooru.donmai.us/wiki_pages/howto%3Atag_checklist)：基本的なタグから専門的なタグへ段階的に整理する考え方を示す。

Danbooruのカテゴリ（General / Artist / Copyright / Character / Meta）は投稿サイト上のタグ種別であり、画像生成辞典で必要な「髪」「服装」「構図」「照明」などの意味分類とは目的が異なる。両者を同じ分類軸として混ぜない。

### 日本語の画像生成プロンプト辞典・ガイド

- [kawasyo web AI：AI画像生成プロンプト辞典](https://www.kawasyo.online/ai-image-prompt-dictionary/)：被写体・人物属性・身体特徴・表情・カメラ・照明・ポーズ・髪・メイク・服装・背景・画風を分けている。
- [イラストプロンプト大全](https://illustprompt.com/)：髪、色、身体、表情、服装、小物、ポーズ、種族、背景、構図、光、画風・品質などの実用分野に分けている。
- [MYKY Prompt](https://prompt.myky-studio.com/)：被写体、構図、表情、ポーズ、服装、背景、世界観、食べ物、画風・品質などの分類と、成人向け語彙の表示切替を採用している。
- [Prompta：Stable Diffusionプロンプトガイド](https://www.prompta.jp/guides/stable-diffusion-prompt-guide)：主題、スタイル、品質、構図、照明、背景、細部、雰囲気をプロンプト構成要素として整理している。

これらは利用者が探す入口として有用だが、分類境界やプロンプト順序はサイトごとに異なる。単一サイトの分類を正解としてコピーしない。

## 設計原則（案）

1. **意味分類は1タグ1つを基本とする。** タグが何を表すかで主分類を決め、検索・表示上の都合だけで複数カテゴリへ重複登録しない。
2. **横断属性はカテゴリにしない。** 成人向けレーティング、確認状態、Positive / Negative の出力先、出典、廃止・別名状態などはタグの管理属性として保持する。
3. **色を独立した大分類にしない。** blue hair は髪、blue eyes は目、blue dress は服装など、色が修飾する対象の意味分類へ置く。必要なら色属性を検索用ファセットとして後から追加するが、出力カテゴリにはしない。
4. **品質タグとネガティブタグは意味上の品質領域にまとめ、出力先を分離する。** ネガティブであることをカテゴリ名だけで表現しない。
5. **作品・キャラクター・作者などの固有名詞は一般的な描写タグと区別する。** Danbooruのタグ種別を参考にしつつ、辞典側では検索・選択に必要な独立した意味分類として扱う。
6. **同義語と関連語を区別する。** 同義語・表記揺れは正規タグへの別名、上位・下位・関連語は別の関係として保持する。
7. **定義と翻訳を分離する。** 日本語欄は短い表示訳、説明欄は意味・適用条件・誤用注意を記録する。
8. **出典・ライセンスを記録する。** 出典不明の既存データについては推測で埋めず、未確認として扱う。第三者データの再配布条件を確認する前に一括取り込みしない。
9. **分類の確度を明示する。** 自動推定・暫定・要確認・人手確認済みを区別し、要確認を確定扱いしない。
10. **出力順はカテゴリ定義側で一元管理する。** UIのカテゴリ順とプロンプト出力順を別々に持たず、同じ順序定義を参照させる。

## 新データモデル案（未確定）

### Tag レコード

| フィールド | 型 | 用途 |
|---|---|---|
| id | string | 変更されない内部ID |
| tag | string | 英語の正規タグ |
| ja | string | 短い日本語訳・表示名 |
| categoryId | string | 主分類ID |
| subcategoryId | string / null | 小分類ID |
| aliases | string[] | 同義語・表記揺れ。別タグとして出力しない |
| keywords | string[] | 日本語・英語の検索補助語 |
| definition | string | 意味と適用条件 |
| usageNotes | string | 誤用・モデル差・除外条件など |
| relations | object | synonyms / broader / narrower / related の関係 |
| attributes | object | rating / promptTarget / reviewStatus / deprecated 等 |
| sourceIds | string[] | 出典レコードへの参照 |
| preview | object / null | 将来の画像プレビュー情報 |

### 横断属性の候補

- rating: general / mature / explicit など。初期表示のフィルターに使う。
- promptTarget: positive / negative / both / none。出力先を制御する。
- reviewStatus: verified / provisional / needs_review。確認状態を表す。
- deprecated: 廃止・非推奨タグかどうか。
- sourceIds: 出典データとの紐付け。タグ本体に長い出典説明を重複保持しない。

### Category レコード

| フィールド | 型 | 用途 |
|---|---|---|
| id | string | 安定した分類ID |
| nameJa / nameEn | string | 表示名 |
| description | string | 分類対象と境界の説明 |
| order | number | UI・プロンプト共通の順序 |
| subcategories | array | 小分類とその説明 |

### Source レコード

出典名、URL、参照日、提供データの範囲、ライセンス表記、再配布可否、注意事項を保持する。タグ単位の出典が分からない場合は、データセット単位の出典として記録し、個別タグの根拠だと誤認させない。

## JSON分割案

- data/categories.json: 分類・小分類・順序
- data/tags-core.json: 正規タグ・翻訳・分類・短い説明
- data/tag-relations.json: 別名・上位下位・関連タグ
- data/sources.json: 出典・ライセンス情報
- data/tag-groups.json: セット追加などの目的別グループ（意味分類とは別）

ファイル分割は案であり、件数・更新頻度・読み込み性能を見て最終決定する。まずスキーマと分類定義を確定し、その後にJSONを生成する。

## 未決事項

- 最終的な大分類・小分類の名称、境界、順序
- 作品・キャラクター・作者を1分類にまとめるか、別分類にするか
- 人物の特徴・顔・髪・身体の分割粒度
- 物品・家具・乗り物・食べ物・楽器などの境界
- 成人向けレーティングの段階と初期表示の扱い
- 既存タグの移行・重複統合・翻訳再確認のルール
- 既存データおよび外部データの利用条件の確認

この文書は設計のたたき台であり、分類体系の確定やタグデータの取り込みを承認したものではない。
