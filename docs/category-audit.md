# Tag category audit: first pass

## Scope

This is a review policy and implementation note, not a claim that all 11,047 tags have been individually reclassified. The source data contains a mixture of categorized rows, legacy categories, and rows without category fields. Runtime normalization may change legacy categories, so raw JSON counts must not be treated as final UI counts.

## Risks found in the current classifier

1. **Missing categories remain missing.** `normalizeCategory()` returns `未分類` for missing/unknown major categories instead of assigning a candidate. This is safe against false certainty, but means a large part of the data still needs review.
2. **Keyword inference is not semantic classification.** `inferPersonMinor()` and `inferClothingMinor()` use English substring/word patterns. Tags that are proper nouns, compound concepts, or ambiguous can be routed incorrectly.
3. **Fallback categories can hide uncertainty.** Invalid minor/detail values may be replaced with a default or first allowed option. The result looks complete even if the inference was weak.
4. **Legacy category conversion is not validation.** Mapping old labels such as `髪・目・体` into `人物` does not guarantee the inferred minor/detail is correct.
5. **Adult and general-body tags need a consistent boundary.** Physical anatomy, clothing/undressing, and explicit situation tags should be distinguished by meaning, not a single keyword alone.
6. **"その他" can become a catch-all.** Animals, objects, natural features, and visual effects should remain separate minor categories under `その他` where appropriate.

## Review policy

- Keep the existing English tag as the stable identifier.
- Do not silently replace a category when the tag meaning is ambiguous.
- Use the three levels: major, minor, detail. Each level must be valid under the taxonomy.
- Mark low-confidence, proper-noun, or context-dependent tags as requiring review rather than forcing a category.
- Treat a 👎 as a review signal, not an automatic correction.
- Keep translation and category votes independent.
- Keep votes in browser localStorage for this first iteration; they are not shared across devices and do not modify `data/tags.json`.

## Recommended classification workflow

1. Normalize and document the allowed category tree.
2. Generate candidate classifications in batches, using the tag, existing Japanese translation, and current category as context.
3. Store the proposed category, confidence, and reason separately from the canonical tag data.
4. Review uncertain and low-confidence rows first.
5. Apply approved changes to the canonical dataset only after checking that every major/minor/detail combination is valid.
6. Recalculate counts from the runtime-normalized data and inspect samples from every category.

## Current taxonomy review points

- `人物`: distinguish head hair, eyes, facial expression, body part, age, count, physique, and species/role. The current word rules can mistake compound tags or named entities.
- `服装`: keep clothing, shoes, accessories, underwear/swimwear, and equipment separate. Generic items such as ribbons or masks may depend on usage.
- `ポーズ・動作`: separate static posture from action, hand gestures, and interaction with another subject.
- `構図・視点`: separate composition/layout, crop/framing, camera angle, and point of view.
- `シチュエーション`: classify relationships, everyday situations, events, and adult situations by meaning.
- `背景・場所`: distinguish indoor rooms, facilities, nature, urban scenery, and time/weather.
- `画風・品質`: separate style, quality, rendering technique, and medium.
- `光・色彩`: distinguish illumination, color identity, and overall color tone. A color plus "hair/eyes" usually belongs under `人物`, not color.
- `その他`: use for animals, objects, natural objects, and graphic effects that do not fit a more specific major category.
- `成人向け`: reserve for adult-specific acts/situations/depictions; general anatomy or ordinary clothing should not be moved here merely because a keyword appears.

## What this change implements

- Independent 👍/👎 controls for Japanese translation and category classification.
- A filter for all review candidates (uncategorized, untranslated, or downvoted), plus filters for category 👎 and translation 👎.
- Local persistence of votes using a separate key, without changing tag data or overwriting translations/categories.

## Known limitation

The vote data is local to the current browser. This change does not yet include cross-device aggregation, an export dashboard, or a complete GPT-generated category patch for every tag. Those require a separate batch classification and validation pass; they must not be represented as completed by this UI change.
