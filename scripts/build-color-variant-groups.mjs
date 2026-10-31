import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tagsPath = resolve(root, "data/tags.json");
const outputPath = resolve(root, "data/color-variant-groups.json");
const rows = JSON.parse(await readFile(tagsPath, "utf8"));
if (!Array.isArray(rows)) throw new Error("data/tags.json must be an array");

const colors = [
  "black", "white", "gray", "grey", "silver", "red", "pink", "orange",
  "yellow", "gold", "golden", "brown", "beige", "cream", "ivory",
  "green", "lime", "olive", "teal", "turquoise", "cyan", "blue", "navy",
  "indigo", "purple", "violet", "magenta", "maroon", "burgundy", "lavender",
  "blonde", "blond", "dark red", "light red", "dark blue", "light blue",
  "dark green", "light green", "dark brown", "light brown", "dark pink", "light pink"
];
const excludedBases = new Set(["hour", "male underwear", "male swimwear"]);
const escapeRegex = value => value.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
const colorPattern = new RegExp("^(" + colors.slice().sort((a,b)=>b.length-a.length).map(escapeRegex).join("|") + ") (.+)$", "i");
const byBase = new Map();
for (const row of rows) {
  const tag = String(row?.[0] ?? "").trim();
  if (!tag || /\\([^)]{1,80}\\)/.test(tag)) continue;
  const match = tag.toLowerCase().match(colorPattern);
  if (!match) continue;
  const color = match[1].toLowerCase(), base = match[2].toLowerCase();
  if (excludedBases.has(base)) continue;
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push({ tag, color });
}
const tagMap = new Map(rows.map(row => [String(row?.[0] ?? "").toLowerCase(), row]));
const colorOrder = new Map(colors.map((color,index)=>[color,index]));
const groups = [...byBase]
  .filter(([,items]) => new Set(items.map(item=>item.color)).size >= 2)
  .map(([base,items]) => {
    const options = items.sort((a,b)=>(colorOrder.get(a.color)??999)-(colorOrder.get(b.color)??999)||a.tag.localeCompare(b.tag));
    const baseRow = tagMap.get(base);
    const ja = baseRow?.[1] || ({hair:"髪色",eyes:"目の色",background:"背景色",footwear:"履物の色",fur:"毛色",hands:"手の色",nails:"爪の色",sclera:"強膜の色",skin:"肌の色",sleeves:"袖の色",theme:"色調",gemstone:"宝石の色",pupils:"瞳孔の色",trim:"縁取りの色"}[base] || "色違いを選択");
    return { id:base, ja, baseTag:baseRow ? base : null, members:[...(baseRow?[base]:[]),...options.map(item=>item.tag)], options };
  })
  .sort((a,b)=>a.id.localeCompare(b.id,"en"));
const output = {
  schema:"color-variant-groups-v1",
  generatedFrom:"data/tags.json",
  rules:{minimumDistinctColors:2,excludeParentheticalTags:true,excludedBases:[...excludedBases]},
  groupCount:groups.length,
  groups
};
await writeFile(outputPath, JSON.stringify(output,null,2)+"\\n", "utf8");
console.log("Color variant groups: " + groups.length);
console.log("Grouped source tags: " + groups.reduce((sum,group)=>sum+group.options.length,0));
