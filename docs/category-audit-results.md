# Category audit — full dataset candidate pass

## Coverage

- Source rows: **11,047**
- Rows with existing category fields: **4,322**
- Rows without category fields: **6,725**
- Missing-category candidate inventory: `data/category-audit-candidates-01.jsonl` through `data/category-audit-candidates-12.jsonl` (all source rows represented).
- Existing-category mismatch candidates: **122** in `data/category-audit-existing-flags.jsonl`.
- The mismatch scan excludes the legacy categories `髪・目・体` and `顔・表情`, which the current app explicitly normalizes at runtime.

## Method

1. Creates keyword-based category candidates for rows without source categories, using English tags and Japanese translations.
2. Flags existing categories where obvious tag keywords conflict with the saved major category (clothing, hair, eyes, pose/action, composition/viewpoint, style/quality, lighting).
3. Keeps all candidate data separate from canonical `data/tags.json`.

## Limitations

This is a deterministic keyword audit, **not an LLM semantic review**. Compound tags, proper nouns, and mixed-attribute tags can trigger false positives. All inferred detail levels remain `要確認`; ambiguous or unmatched records remain `未分類`. A flagged entry is a review candidate, not a confirmed error.

## Next review order

- Validate the mismatch candidates against actual tag meaning.
- Review high-frequency tags and common prompt-building tags first.
- Resolve taxonomy boundaries: anatomy vs clothing vs adult content; pose vs action; composition vs viewpoint; and catch-all `その他`.
- Apply only manually reviewed changes to `data/tags.json` in a separate diff.
