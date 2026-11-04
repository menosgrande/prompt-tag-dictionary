import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const KNOWN_MISTRANSLATIONS = new Map([
  ["ace attorney", ["エース弁護士"]], ["adventure time", ["冒険の時間"]],
  ["adventurer (ff11)", ["アバター（FF11）"]], ["after vaginal", ["膣の後"]],
  ["battle axe", ["戦いx"]], ["bb (fate/extra)", ["BB（運命/エクストラ）"]],
  ["blue poison (arknights)", ["青い毒（arknights）"]],
  ["boruto: naruto next generations", ["Boruto：NARUTO-次の世代"]],
  ["breast envy", ["胸のen望"]], ["caressing testicles", ["愛sist丸"]],
  ["fate/extra", ["運命/エクストラ"]], ["imizu (nitro unknown)", ["イミズ（ニトロ不明）"]],
  ["tamamo no mae (fate/extra)", ["Tamamo no Mae（運命/エクストラ）"]],
  ["yuuji (and)", ["ユウジ（そして）"]], [":/", ["歪嘴"]], [":|", ["平嘴"]]
]);
const SUSPICIOUS_PATTERNS = [/不条理な|賞賛する|青いアーカイブ|女の子とパンツァー|貧しい女の子の過剰摂取|ニトロ不明/, /(?:^|[（(])(?:運命\/|次の世代|そして）|エクストラ)/, /[A-Za-z]{2,}[ぁ-んァ-ヶ一-龠]|[ぁ-んァ-ヶ一-龠][A-Za-z]{2,}/];
const normalize = value => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase();
function classifyTranslation(tag, ja) {
  const reasons=[], normalizedTag=normalize(tag), normalizedJa=normalize(ja);
  if (!normalizedJa) reasons.push("japanese-translation-missing");
  if (KNOWN_MISTRANSLATIONS.get(normalizedTag)?.some(value=>normalize(value)===normalizedJa)) reasons.push("known-mistranslation");
  if (/[A-Za-z]{3,}/.test(ja)) reasons.push("english-remains-in-japanese");
  if (/[\u4e00-\u9fff]/.test(ja) && !/[ぁ-んァ-ヶ]/.test(ja) && /歪嘴|平嘴/.test(ja)) reasons.push("possible-chinese-text");
  if (SUSPICIOUS_PATTERNS.some(pattern=>pattern.test(ja))) reasons.push("unnatural-or-mixed-script");
  if (ja && normalizedTag===normalizedJa && /[A-Za-z]/.test(ja)) reasons.push("same-as-latin-tag");
  const unique=[...new Set(reasons)];
  const confidence=unique.includes("known-mistranslation")?"high":unique.some(x=>["japanese-translation-missing","same-as-latin-tag","possible-chinese-text","unnatural-or-mixed-script"].includes(x))?"medium":"low";
  return {reasons:unique,confidence};
}
export function collectCandidates(records, reviewEntries = {}) {
  const candidates=[];
  for(const row of records){
    if(!Array.isArray(row)||![4,6,7].includes(row.length)||row.slice(0,4).some(value=>typeof value!=="string")||
      (row.length>=6&&(typeof row[4]!=="string"||!Array.isArray(row[5])||row[5].some(value=>typeof value!=="string")))) continue;
    const [tag,rawJa,major,minor]=row,ja=rawJa.trim(),{reasons,confidence}=classifyTranslation(tag,ja);
    if(!reasons.length) continue;
    candidates.push({tag,ja,major,minor,reasons,confidence,status:row[6]?.translation?.status??reviewEntries[tag]?.translationStatus??"unreviewed",proposedJa:null});
  }
  return candidates;
}
async function main(){
  const data=JSON.parse(await readFile(new URL("../data/dictionary-data.json",import.meta.url),"utf8"));
  const candidates=collectCandidates(data.tags),counts=Object.create(null),confidence=Object.create(null),statuses=Object.create(null);
  for(const item of candidates){confidence[item.confidence]=(confidence[item.confidence]||0)+1;statuses[item.status]=(statuses[item.status]||0)+1;for(const reason of item.reasons)counts[reason]=(counts[reason]||0)+1;}
  console.log("Translation quality audit");
  console.log("Tags scanned: "+data.tags.length);
  console.log("Candidate records: "+candidates.length);
  console.log("Confidence: "+JSON.stringify(confidence));
  for(const [reason,count] of Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0]))) console.log("  "+reason+": "+count);
  console.log("Embedded translation statuses among findings: "+JSON.stringify(statuses));
  console.log("Diagnostic only: canonical translation metadata remains embedded in dictionary-data.json.");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
