# Category audit — full dataset candidate pass

- Source rows: **11,047**
- Existing category rows retained but not semantically verified: **4,322**
- Rows without source categories: **6,725**
- Candidate inventory: `data/category-audit-candidates-01.jsonl` through `data/category-audit-candidates-12.jsonl` (11,047 source rows).
- Existing-category mismatch candidates: **122** in `data/category-audit-existing-flags.jsonl`.

## Method and limitations

This is a deterministic keyword-based first pass with English token-boundary checks, **not an LLM semantic review**. Missing-category candidates use English tags and existing Japanese translations; translation-derived matches can still confuse proper names and compound tags. Existing categories are preserved and marked unverified. Every inferred detail remains `要確認`; ambiguous or unmatched records remain `未分類`.

The mismatch scan uses explicit English tag keywords and excludes legacy majors `髪・目・体` and `顔・表情`, which the current app normalizes at runtime. A flagged row is a review candidate, not a confirmed error. Candidate labels are not automatically applied.

Canonical `data/tags.json` is unchanged. Next, manually validate candidates, prioritize common tags, and review boundaries such as anatomy vs clothing vs adult content; pose vs action; composition vs viewpoint; and catch-all `その他`. Only reviewed changes should be applied in a separate diff.
