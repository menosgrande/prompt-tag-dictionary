# Tag data quality audit

Audit date: 2026-10-28

## Current verified snapshot

The bundled dataset contains 11,047 tags. Its records now use a consistent four-string array format: [tag, ja, major, minor].

| Check | Current result | Interpretation |
|---|---:|---|
| Schema-invalid rows | 0 | Every row has four string fields |
| Invalid major/minor category pairs | 0 | Stored category labels match the app's current category schema |
| Duplicate normalized tags | 0 | No duplicate keys under NFKC + lowercase + underscore/space normalization |
| Missing Japanese labels | 186 | Translation work remains |
| Unclassified tags | 6,081 | About 55% still need category review |
| Tags containing parentheses | 1,130 | Parentheses are a clue, not enough to classify by themselves |
| Parenthetical tags still unclassified | 272 | These need review rather than blanket classification |

The category migration changed 703 records that used the old major categories "髪・目・体" and "顔・表情" to the current schema. It also converted 48 records with the old "人物 / 属性・役割" minor, 14 records with "背景・場所 / 屋内・施設", and 4 records with "光・色彩 / 色・色調". Legacy records were categorized by conservative keyword rules; the resulting values are structurally valid but are not proof that every semantic classification is correct.

## Confirmed engineering issues

### 1. Import parsing did not consistently retain the input filename

The JSON parser previously copied array rows and object rows without attaching the file name in all branches. This made provenance disappear at the moment of import.

Change: future JSON imports attach the selected file name to each imported record. The app also retains a combined list of contributing file names when records merge.

### 2. Duplicate imports silently overwrote non-empty data

The prior merge rule preferred every incoming non-empty Japanese translation and every incoming non-unclassified category. That meant a later machine translation or a legacy category could replace a better or more current value without warning.

Change: the default merge preserves the first non-empty translation and first classified category; missing fields can be filled from later sources. Different non-empty translations/categories are counted and reported in the import dialog. Input files are processed in filename order so the result is deterministic for the same filenames.

### 3. Existing browser storage could hide updates from the repository

Previously, any saved localStorage dataset replaced the bundled dataset at startup. A user who had opened the app before a data correction could therefore keep seeing stale records indefinitely.

Change: startup now merges the bundled seed into saved data. Seed-only/legacy rows are refreshed from the current bundled dataset; separately imported/custom records are preserved. Existing user data should still be checked after major schema changes.

### 4. Stored records used multiple row lengths and retired category names

Before this audit, records had 1, 2, or 4 fields, and 703 rows used retired category names. Several minor labels no longer existed in the current category list.

Change: all bundled rows now use the same four-field shape, and the known retired labels were migrated. The app still performs normalization on loading/import as a safety net.

## Remaining data-quality risks

- The current dictionary does not preserve the origin URL, retrieval date, source revision, or per-tag source/translation lineage for historical records. See data/sources.json; unknown values are intentionally not guessed.
- 186 tags still lack Japanese labels.
- 6,081 tags remain unclassified, including 272 tags with parentheses in their names. Do not treat parentheses alone as evidence that a tag is a character or anime/game title.
- A structurally valid category can still be semantically wrong. The audit script validates schema and category names, not human-level correctness.
- Translation rows can contain machine translations, aliases, mistranslations, or inconsistent proper-name spellings. The conflict counter helps prevent silent replacement but does not decide which translation is correct.
- Imported filenames are provenance hints, not quality scores or license evidence.

## Repeatable checks

Run these from the repository root:

    node --check src/app.js
    node scripts/audit-tags.mjs

GitHub Actions runs both checks when the tag dataset, app, or audit script changes. The audit fails on malformed records, invalid category pairs, and normalized duplicate tags. Missing translations and unclassified tags are warnings because they are known backlog rather than file-integrity failures.
