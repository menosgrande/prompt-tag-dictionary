import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const date = new Date().toISOString().slice(0, 10);
const paths = {
  tags: resolve(root, "data/tags.json"),
  review: resolve(root, "data/tag-review.json"),
  log: resolve(root, "data/tag-change-log.json")
};
const allowed = {
  "人物": ["人数", "性別・体形", "年齢", "頭髪", "顔・表情", "目", "胸", "身体・部位", "種族・役割"],
  "作品・キャラクター": ["作品名・シリーズ", "キャラクター", "作者・配信者"],
  "背景・場所": ["屋内", "施設", "自然", "都市", "時間・天候"],
  "構図・視点": ["構図", "撮影範囲", "カメラ角度", "視点"],
  "画風・品質": ["画風", "品質", "描写技法", "媒体"],
  "光・色彩": ["照明", "色", "色調"],
  "服装": ["衣類", "靴", "小物", "下着・水着", "装備"],
  "ポーズ・動作": ["姿勢", "行動", "手の動き", "対人動作"],
  "シチュエーション": ["関係性", "日常", "イベント", "成人向け状況"],
  "その他": ["動物", "物", "自然物", "記号・効果"],
  "成人向け": ["身体・衣類", "行為・状況", "表現・修正"],
  "未分類": ["未分類"]
};
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const [tags, review, log] = await Promise.all([
  readJson(paths.tags), readJson(paths.review), readJson(paths.log)
]);
if (!Array.isArray(tags) || review.schemaVersion !== 1 || !review.entries || log.schemaVersion !== 1 || !Array.isArray(log.changes)) {
  throw new Error("Unexpected tags/review/log schema; no files were changed.");
}
const index = new Map(tags.map((row, i) => [row?.[0], i]));
const proposals = [];
for (let n = 1; n <= 12; n++) {
  const name = "category-audit-candidates-" + String(n).padStart(2, "0") + ".jsonl";
  const content = await readFile(resolve(root, "data", name), "utf8");
  for (const line of content.split(/\\r?\\n/).filter(Boolean)) {
    const value = JSON.parse(line);
    if (!Array.isArray(value) || value[4] !== "分類候補" || value[5] !== "medium" || value[2] !== null || !Array.isArray(value[3])) continue;
    const [major, minor, detail] = value[3];
    const i = index.get(value[0]);
    if (i === undefined) continue;
    const row = tags[i];
    if (!Array.isArray(row) || row.length !== 4 || row[2] !== "未分類" || row[3] !== "未分類") continue;
    if (!allowed[major]?.includes(minor)) continue;
    const prior = review.entries[value[0]] || {};
    if (["verified", "needs-review"].includes(prior.classificationStatus)) continue;
    proposals.push({ tag: value[0], major, minor, detail, reason: value[6], source: name, index: i });
  }
}
if (new Set(proposals.map(item => item.tag)).size !== proposals.length) {
  throw new Error("Duplicate candidate tags detected; no files were changed.");
}
for (const item of proposals) {
  const row = tags[item.index];
  const before = { major: row[2], minor: row[3] };
  row[2] = item.major;
  row[3] = item.minor;
  const prior = review.entries[item.tag] || {};
  review.entries[item.tag] = {
    ...prior,
    translationStatus: prior.translationStatus || "unreviewed",
    classificationStatus: "provisional",
    reviewedAt: prior.reviewedAt ?? null,
    note: [prior.note, "決定的キーワード規則による中程度の分類候補を仮適用。人手確認待ち。第3階層候補「" + item.detail + "」は4項目のtags.json形式を維持するため未反映。"].filter(Boolean).join(" "),
    source: prior.source ?? item.source
  };
  log.changes.push({
    tag: item.tag, changedAt: date, fields: ["major", "minor"],
    before, after: { major: item.major, minor: item.minor },
    reason: item.reason + "。中程度の自動分類候補を仮適用。意味上の正しさは未確認で、管理画面で人手確認が必要。第3階層候補「" + item.detail + "」は既存4項目スキーマを維持するため未適用。",
    source: "data/" + item.source
  });
}
console.log("Safe category auto-apply");
console.log("Provisional classifications: " + proposals.length);
console.log("Canonical tag schema: [tag, ja, major, minor] (unchanged)");
console.log("Human-reviewed / needs-review entries: skipped");
console.log("Third-level proposals: retained in audit source, not written to tags.json");
if (write) {
  await Promise.all([
    writeFile(paths.tags, JSON.stringify(tags, null, 2) + "\\n", "utf8"),
    writeFile(paths.review, JSON.stringify(review, null, 2) + "\\n", "utf8"),
    writeFile(paths.log, JSON.stringify(log, null, 2) + "\\n", "utf8")
  ]);
  console.log("Updated tags.json, tag-review.json, and tag-change-log.json");
} else {
  console.log("Dry run only. Pass --write to apply.");
}
