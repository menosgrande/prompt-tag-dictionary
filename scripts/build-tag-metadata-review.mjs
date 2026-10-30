import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = resolve(root, "data/nsfw-prompt-tag-audit.json");
const tagsPath = resolve(root, "data/tags.json");
const outputPath = resolve(root, "data/tag-metadata-review.json");
const write = process.argv.includes("--write");
const [audit, tags] = await Promise.all([readFile(auditPath,"utf8").then(JSON.parse),readFile(tagsPath,"utf8").then(JSON.parse)]);
if(audit.schema!=="nsfw-prompt-tag-research-v3"||!Array.isArray(audit.candidates)||!Array.isArray(tags)) throw new Error("Unexpected source schema; no output written.");
const known=new Map(tags.map(row=>[String(row?.[0]??"").normalize("NFKC").toLowerCase(),row]));
const explicitR18=new Set(["nude","bottomless","topless","no panties","naked apron","naked shirt","nude cover","hand in panties","hand in bra","crotch grab","ass grab","spread ass","grabbing own ass","grabbing another's ass"]);
const entries={};
for(const item of audit.candidates){
 if(!item||typeof item.tag!=="string"||![true,false,null].includes(item.nsfw)) throw new Error("Invalid candidate row; no output written.");
 const key=item.tag.normalize("NFKC").toLowerCase();
 entries[item.tag]={nsfwCandidate:item.nsfw,nsfwReviewStatus:"unreviewed",proposedRating:explicitR18.has(key)?"R-18":"未判定",ratingReviewStatus:"unreviewed",candidateStatus:known.has(key)?"exact_existing":item.status,source:item.source,note:"自動候補。確定値ではない。nsfwCandidate と proposedRating は別々に人手確認する。"};
}
const result={schemaVersion:1,description:"NSFW・年齢レーティングのレビュー候補。tags.jsonには統合せず、候補値と確定値を分離する。",ratingValues:["全年齢","R-13","R-15","R-18","未判定"],nsfwValues:[true,false,null],entries};
console.log("Metadata review candidates: "+Object.keys(entries).length);
console.log("Exact existing tags: "+Object.values(entries).filter(x=>x.candidateStatus==="exact_existing").length);
console.log("New candidates: "+Object.values(entries).filter(x=>x.candidateStatus==="candidate_new").length);
console.log("R-18 proposals: "+Object.values(entries).filter(x=>x.proposedRating==="R-18").length);
console.log("All rating and NSFW values remain unreviewed; no confirmed values are created.");
if(write){await writeFile(outputPath,JSON.stringify(result,null,2)+"\n","utf8");console.log("Wrote data/tag-metadata-review.json");}else console.log("Dry run only. Pass --write to generate the sidecar.");
