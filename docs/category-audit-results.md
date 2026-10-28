# Category audit — safer candidate pass

## Coverage
- Source rows: **11,047**
- Existing category fields retained but unverified: **4,322**
- Rows without source categories: **6,725**
- Missing-category rows with a single-major/single-minor candidate: **1,025**
- Missing-category rows left unclassified: **5,700**
- Ambiguous or unmatched missing-category rows: **5,700**
- Existing-category mismatch candidates: **122**

All source rows are represented in `data/category-audit-candidates-01.jsonl` through `data/category-audit-candidates-12.jsonl`. Existing-category flags are in `data/category-audit-existing-flags.jsonl`.

## Method
This version uses the English tag string as its primary classification evidence, with explicit token boundaries. It does not broadly search Japanese translations because generic Japanese substrings generated false positives on proper names. A small exact-value map handles selected symbol/emoticon tags. When several majors or minors match, the proposal is left `未分類` with an explanation. Inferred category details remain `要確認`.

## Limitations
This remains a deterministic heuristic pass, **not an LLM semantic review**. It may miss valid classifications and still produce false positives on compound tags. Existing categories are preserved but not endorsed. Existing mismatch flags are review candidates rather than confirmed errors. Canonical `data/tags.json` is unchanged and no proposal is automatically applied.

## Next
Review common high-value tags and flagged mismatches, finalize taxonomy boundaries, and only then apply manually validated changes in a separate patch.
