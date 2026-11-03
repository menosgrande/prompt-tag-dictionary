import { readMasterSource, writeMasterSources } from "./lib/master-data.mjs";

const root = process.cwd();
const rows = await readMasterSource(root, "tags.json");
const colors = ["red","blue","green","yellow","orange","pink","purple","violet","black","white","gray","grey","brown","beige","blonde","golden","silver","crimson","scarlet","navy","cyan","magenta","turquoise","teal","ivory","maroon","burgundy","lavender","indigo","khaki","cream","coral","mint","emerald","ruby","sapphire"];
const garments = ["apron","armor","armour","belt","bikini","bowtie","cape","cardigan","cloak","coat","collar","corset","dress","garter belt","garter straps","gloves","hat","hoodie","jacket","kimono","leotard","necktie","one-piece swimsuit","overalls","pants","ribbon","robe","sailor collar","scarf","shirt","shorts","skirt","sleeves","socks","suit","sweater","sweater vest","tie","vest","uniform","outfit","stockings","shoes","boots","heels","gown","swimsuit"];
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const colorAtStart = new RegExp("^(" + colors.map(escapeRe).join("|") + ")[- ]+(.+)$", "i");
const garmentPattern = new RegExp("\\b(" + garments.map(escapeRe).join("|") + ")\\b", "i");
const ambiguous = /\b(armor|armour|belt|bowtie|cape|cloak|collar|garter belt|ribbon|robe|sailor collar|suit|sweater vest|tie|vest|coat|uniform|outfit)\b/i;

const candidates = rows.flatMap(row => {
  const tag = String(row[0] ?? "");
  const match = tag.match(colorAtStart);
  if (!match || !garmentPattern.test(match[2])) return [];
  const status = /\([^)]{2,}\)/.test(tag)
    ? "protected"
    : ambiguous.test(match[2]) ? "review" : "exclude_candidate";
  return [{
    tag,
    ja: String(row[1] ?? ""),
    major: String(row[2] ?? ""),
    minor: String(row[3] ?? ""),
    matched_color: match[1].toLowerCase(),
    matched_object: match[2],
    status,
    reason: status === "protected"
      ? "括弧付き固有名詞・作品名を含むため保護"
      : status === "review"
        ? "意味が色付き衣類以外にもなり得るため要確認"
        : "一般的な衣類・装飾品に色形容詞が付いたタグ。色彩プロンプト索引からの除外候補"
  }];
});

const protectedExamples = rows
  .filter(row => /\(blue archive\)/i.test(String(row[0] ?? "")))
  .map(row => String(row[0]));

const result = {
  generated_by: "scripts/audit-color-clothing.mjs",
  version: 1,
  source: "data/tags.json",
  policy: "候補抽出のみ。タグ本体は削除・変更しない。作品名・キャラクター名など固有名詞は保持する。",
  summary: {
    total: candidates.length,
    exclude_candidate: candidates.filter(x => x.status === "exclude_candidate").length,
    review: candidates.filter(x => x.status === "review").length,
    protected: candidates.filter(x => x.status === "protected").length
  },
  protected_examples: { blue_archive: protectedExamples },
  candidates
};

await writeMasterSources(root, { "color-clothing-audit.json": result });
console.log(JSON.stringify(result.summary));
