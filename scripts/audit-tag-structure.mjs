import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rows = JSON.parse(fs.readFileSync(path.join(root, "data/tags.json"), "utf8"));
const output = path.join(root, "data/tag-structure-audit.json");
const adjectives = ["very","too","slightly","extremely","long","short","big","small","large","huge","tiny","tall","wide","narrow","thick","thin","slim","slender","curvy","plump","muscular","pale","dark","light","bright","deep","soft","hard","smooth","rough","wet","dry","messy","neat","straight","curly","wavy","spiky","fluffy","shiny","glossy","matte","transparent","translucent","opaque","sheer","tight","loose","oversized","baggy","short-sleeved","long-sleeved","sleeveless","high","low","open","closed","half","partially","fully","bare","barely","colored","colourful","colorful","black","white","red","blue","green","yellow","orange","pink","purple","violet","brown","gray","grey","silver","gold","golden","blonde","navy","cyan","magenta","beige","ivory","cream","crimson","scarlet","burgundy","maroon","lavender","indigo","turquoise","teal","mint","emerald","coral","khaki"];
const normalize = value => value.toLowerCase().trim().replace(/[_\s-]+/g, " ");
const groupBy = (items, keyFn) => {
  const groups = new Map();
  for (const item of items) { const key = keyFn(item); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
};
const translationGroups = groupBy(rows.filter(row => String(row[1] ?? "").trim()), row => String(row[1]).trim().toLowerCase())
  .map(([ja, group]) => ({ ja, tags: group.map(row => String(row[0])) }));
const hasPrefix = (tag, adj) => {
  const value = String(tag).toLowerCase();
  return [" ", "-", "_"].some(separator => value.startsWith(adj + separator));
};
const adjectiveCandidates = rows.filter(row => adjectives.some(adj => hasPrefix(row[0], adj)));
const adjectivePrefixCandidates = {};
for (const adj of adjectives) {
  const matches = adjectiveCandidates.filter(row => hasPrefix(row[0], adj));
  if (matches.length) adjectivePrefixCandidates[adj] = matches.map(row => String(row[0]));
}
const normalizedDuplicates = groupBy(rows, row => normalize(String(row[0] ?? "")))
  .filter(([, group]) => new Set(group.map(row => String(row[0]).toLowerCase().trim())).size > 1)
  .map(([normalized, group]) => ({ normalized, tags: group.map(row => String(row[0])) }));
const result = {
  generated_at: new Date().toISOString().slice(0, 10), source: "data/tags.json", source_count: rows.length,
  policy: "監査用候補。タグ本体の削除・改名・統合・再分類は行わない。機械的な文字列検出であり、意味の同一性を確定するものではない。",
  summary: {
    total: rows.length, unique_tag_strings: new Set(rows.map(row => String(row[0]))).size,
    exact_duplicate_groups: groupBy(rows, row => String(row[0]).toLowerCase().trim()).length,
    separator_normalized_duplicate_groups: normalizedDuplicates.length,
    tags_with_spaces: rows.filter(row => String(row[0]).includes(" ")).length,
    tags_with_hyphens: rows.filter(row => String(row[0]).includes("-")).length,
    tags_with_underscores: rows.filter(row => String(row[0]).includes("_")).length,
    tags_with_parentheses: rows.filter(row => /[()]/.test(String(row[0]))).length,
    tags_with_punctuation: rows.filter(row => /[():,+!?'"]/u.test(String(row[0]))).length,
    multiword_tags: rows.filter(row => String(row[0]).trim().split(/\s+/).length >= 2).length,
    adjective_prefix_candidates: adjectiveCandidates.length,
    nonempty_japanese_translation_duplicate_groups: translationGroups.length,
    nonempty_japanese_translation_duplicate_rows: translationGroups.reduce((n, group) => n + group.tags.length, 0)
  },
  separator_normalized_duplicates: normalizedDuplicates,
  adjective_prefix_candidates: adjectivePrefixCandidates,
  japanese_translation_groups: translationGroups
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary));
