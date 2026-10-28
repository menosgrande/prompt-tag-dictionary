# Category audit — full dataset candidate pass

## Coverage

- Source rows: **11,047**
- Rows with existing category fields: **4,322**
- Rows without category fields: **6,725**
- Missing-category candidate inventory: `data/category-audit-candidates-01.jsonl` through `data/category-audit-candidates-12.jsonl` (all 11,047 source rows are represented; 1,000 source rows per part except the final part).
- Existing-category mismatch candidates: **414** entries in `data/category-audit-existing-flags.jsonl`.

## What this pass does

1. Creates keyword-based candidate categories for rows without source categories, using English tags and existing Japanese translations.
2. Separately flags existing categories whose major category conflicts with obvious tag keywords (clothing, hair, eyes, pose/action, composition/viewpoint, style/quality, lighting).
3. Preserves all canonical categories. These are review candidates, not corrections.

## Limitations

This is a deterministic keyword audit, **not an LLM semantic review**. Compound tags, proper nouns, and tags that intentionally combine attributes can trigger false positives or remain unclassified. Every suggested category detail is marked `要確認`; ambiguous candidates remain `未分類`. Existing classifications have not been proven correct merely because they were retained.

## Next review steps

- Manually validate the flagged existing-category mismatches.
- Prioritize common/high-utility tags and tags where current and candidate categories disagree.
- Review taxonomy boundaries: anatomy vs clothing vs adult content; pose vs action; composition vs viewpoint; and catch-all `その他`.
- Apply only reviewed changes to `data/tags.json` in a separate diff.
