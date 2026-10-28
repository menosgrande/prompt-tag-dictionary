# Category audit — full dataset candidate pass

- Source rows: **11,047**
- Existing categories retained but not semantically verified: **4,322**
- Rows without source categories: **6,725**
- Missing-category rows with major/minor candidates: **1,779**
- Missing-category rows left unclassified: **4,946**
- Low-confidence records (ambiguous or unmatched): **4,996**

The complete review inventory is stored as JSONL in `data/category-audit-candidates-*.jsonl` (1,000 source rows per part; first line in part 1 contains metadata). Each record is `[tag, ja, current, proposal, status, confidence, reason]`.

## Method and limitations

This is a deterministic keyword pass against English tags and existing Japanese translations, **not an LLM semantic review**. It creates candidates for review; it does not establish that a proposed category is correct. Existing categories are preserved and marked unverified. Every proposed detail remains `要確認`. Ambiguous or unmatched records remain `未分類`. Canonical `data/tags.json` is unchanged.

## Next review order

1. Validate candidate categories against the actual tag meaning.
2. Audit existing categories for false positives, not just missing categories.
3. Resolve taxonomy boundaries: anatomy vs clothing vs adult content; pose vs action; composition vs viewpoint; and catch-all `その他`.
4. Only after review, create a separate diff that applies approved category changes.
