import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));

const DIRECT = {
  "人物": {
    "人数":"person/people-count","性別・体形":"person/body-shape","年齢":"person/people-count",
    "頭髪":"person/hair-head","顔・表情":"person/face-expression","目":"person/eyes",
    "胸":"person/body-parts","身体・部位":"person/body-parts","種族・役割":"person/species-role"
  },
  "作品・キャラクター": {
    "作品名・シリーズ":"person/works-series","キャラクター":"person/characters","作者・配信者":"person/creators"
  },
  "服装": {
    "衣類":"clothing/clothing","靴":"clothing/footwear","小物":"clothing/props","装備":"clothing/equipment"
  },
  "背景・場所": {
    "屋内":"background/locations","施設":"background/locations","自然":"background/nature-landscape",
    "都市":"background/locations","時間・天候":"background/weather-time"
  },
  "背景": {"物体・小道具":"background/object-items"},
  "構図・視点": {
    "構図":"composition/composition-layout","撮影範囲":"composition/framing",
    "カメラ角度":"composition/camera-angle","視点":"composition/viewpoint-gaze"
  },
  "光・色彩": {
    "照明":"lighting/lighting-source","色":"lighting/color-tone","色調":"lighting/color-tone"
  },
  "その他": {
    "動物":"person/species-role","物":"background/object-items","自然物":"background/nature-landscape",
    "記号・効果":"lighting/effects"
  },
  "ポーズ・動作": {
    "姿勢":"pose/basic-posture","手の動き":"action/hand-action","対人動作":"action/interpersonal-contact"
  }
};

const norm = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
const pair = (path, status="provisional", confidence="medium", reason="旧分類の小分類を新分類へ対応付けた候補。意味上の最終確認は未実施。") => {
  const [categoryId, subcategoryId] = path.split("/");
  return { categoryId, subcategoryId, status, confidence, reason };
};

function classifyAdult(tag) {
  const t = norm(tag);
  if (/\b(swimsuit|bikini|swimwear)\b/.test(t)) return pair("clothing/swimwear","provisional","medium","タグ名に水着を示す語があるため。");
  if (/\b(panties|panty|underwear|bra|lingerie)\b/.test(t)) return pair("clothing/underwear","provisional","medium","タグ名に下着を示す語があるため。");
  if (/\b(nude|naked|topless|bottomless|naked apron)\b/.test(t)) return pair("clothing/nudity","provisional","medium","タグ名に裸体・露出を示す語があるため。");
  if (/\b(breast|breasts|nipple|penis|vagina|vulva|anus|ass|butt|testicle|testicles|crotch|pubic|genital|thigh|belly)\b/.test(t)) return pair("person/body-parts","provisional","medium","タグ名に身体部位を示す語があるため。");
  if (/\b(sex|vaginal|anal|oral|fellatio|cunnilingus|masturbat\w*|fingering|penetrat\w*|licking|caressing|handjob|paizuri|ejaculat\w*|orgasm|groping|fondling)\b/.test(t)) return pair("action/body-contact","provisional","medium","タグ名に行為・接触を示す語があるため。");
  return pair("","needs-review","low","成人向け旧分類だけでは意味分類を確定できないため保留。");
}

function classifyAction(tag) {
  const t=norm(tag);
  if (/\b(sitting|standing|lying|kneeling|crouching|squatting|on all fours|seiza|crossed legs)\b/.test(t)) return pair("pose/basic-posture","provisional","medium","姿勢を表す語を検出。");
  if (/\b(hugging|kissing|holding hands|hand holding|embracing|grabbing another|carrying another)\b/.test(t)) return pair("action/interpersonal-contact","provisional","medium","対人接触を表す語を検出。");
  if (/\b(hand|hands|finger|fingers|fingertip)\b/.test(t)) return pair("action/hand-action","provisional","medium","手・指の動作を表す語を検出。");
  if (/\b(eating|drinking|reading|writing|cooking|cleaning|shopping|walking|sleeping|washing|bathing|studying)\b/.test(t)) return pair("action/daily-action","provisional","medium","日常動作を表す語を検出。");
  if (/\b(holding|carrying|touching|adjusting|pulling|pushing|raising|waving|pointing|looking|smiling|crying|laughing|running|jumping|dancing|playing|riding|fighting|working|stretching|exercising|climbing|swimming|flying)\b/.test(t)) return pair("action/body-action","provisional","medium","動作を表す語を検出。");
  return pair("","needs-review","low","旧「行動」分類だけでは動作と姿勢を区別できないため保留。");
}

function classifyQuality(tag) {
  const t=norm(tag);
  if (/\b(masterpiece|best quality|high quality)\b/.test(t)) return pair("quality/high-quality","provisional","medium","高品質指定を表す語を検出。");
  if (/\b(highres|absurdres|ultra.?detailed|8k|4k|high resolution|highly detailed)\b/.test(t)) return pair("quality/resolution-detail","provisional","medium","解像度・精細度指定を表す語を検出。");
  if (/\b(score[_ -]?\d+|score)\b/.test(t)) return pair("quality/score","provisional","medium","スコア指定を表す語を検出。");
  if (/\b(worst quality|low quality|lowres|blurry|jpeg artifacts|watermark|signature)\b/.test(t)) return pair("quality/low-quality-noise","provisional","medium","低品質・ノイズ指定を表す語を検出。");
  return pair("","needs-review","low","旧「品質」分類だけでは品質・解像度・スコアの区別を確定できないため保留。");
}

export function classifyLegacyRow(row) {
  if (!Array.isArray(row) || row.length !== 4) throw new Error("Expected [tag, ja, major, minor]");
  const [tag, , major, minor] = row;
  if (major === "未分類") return null;
  let result;
  const direct = DIRECT[major]?.[minor];
  if (direct) result = pair(direct);
  else if (major === "服装" && minor === "下着・水着") {
    const t=norm(tag);
    result = /\b(swimsuit|bikini|swimwear)\b/.test(t) ? pair("clothing/swimwear","provisional","medium","タグ名から水着を識別。")
      : /\b(panties|panty|underwear|bra|lingerie)\b/.test(t) ? pair("clothing/underwear","provisional","medium","タグ名から下着を識別。")
      : pair("","needs-review","low","下着・水着が旧小分類で統合されており、タグ名から分離できないため保留。");
  } else if (major === "画風・品質") {
    result = minor === "品質" ? classifyQuality(tag)
      : minor === "画風" ? pair("style/style-medium")
      : minor === "描写技法" ? pair("style/drawing-technique")
      : minor === "媒体" ? pair("style/medium")
      : pair("","needs-review","low","画風・品質の小分類を特定できないため保留。");
  } else if (major === "ポーズ・動作" && minor === "行動") result = classifyAction(tag);
  else if (major === "シチュエーション" && minor === "日常") result = pair("action/daily-action","provisional","medium","旧「日常」分類を日常動作候補として移行。");
  else if (major === "シチュエーション" && minor === "成人向け状況") result = classifyAdult(tag);
  else if (major === "シチュエーション") result = pair("","needs-review","low","関係性・イベントは意味が広いため個別確認が必要。");
  else if (major === "成人向け") result = classifyAdult(tag);
  else if (major === "その他") result = DIRECT[major]?.[minor] ? pair(DIRECT[major][minor]) : pair("","needs-review","low","旧「その他」分類から意味分類を一意に決められないため保留。");
  else result = pair("","needs-review","low","旧分類と小分類の対応が未定義のため保留。");
  return { tag, legacyMajor:major, legacyMinor:minor, ...result };
}

export function buildClassificationCandidates(rows) {
  const entries=[];
  let unclassified=0, provisional=0, needsReview=0;
  for(const row of rows){
    const item=classifyLegacyRow(row);
    if(!item){unclassified++;continue;}
    entries.push(item);
    if(item.status==="provisional")provisional++;
    else if(item.status==="needs-review")needsReview++;
  }
  return {
    schema:"tag-classification-candidates-v1",
    source:"data/tags.json",
    taxonomy:"data/tag-taxonomy.json",
    description:"旧分類から新分類への移行候補。provisionalは自動確定ではなく、既存タグデータへは未反映。needs-reviewは意味分類を推測で確定しない。",
    summary:{totalTags:rows.length,proposed:provisional,needsReview,unclassified,entries:entries.length},
    entries
  };
}

async function main(){
  const rows=await readJson("data/tags.json");
  const taxonomy=await readJson("data/tag-taxonomy.json");
  const report=buildClassificationCandidates(rows);
  const categoryIds=new Set(taxonomy.semanticCategories.map(category=>category.id));
  const subcategories=new Map(taxonomy.semanticCategories.map(category=>[category.id,new Set(category.subcategories.map(item=>item.id))]));
  for(const item of report.entries){
    if(item.categoryId && (!categoryIds.has(item.categoryId) || !subcategories.get(item.categoryId)?.has(item.subcategoryId))){
      throw new Error("Candidate references unknown taxonomy id: "+item.categoryId+"/"+item.subcategoryId);
    }
  }
  const outputPath=resolve(root,"data/tag-classification-candidates.json");
  const serialized=JSON.stringify(report,null,2)+"\n";
  console.log("Classification candidate audit");
  console.log(JSON.stringify(report.summary));
  if(new Set(report.entries.map(x=>x.tag)).size!==report.entries.length) throw new Error("Duplicate candidate tags");
  if(args.has("--write")){await writeFile(outputPath,serialized,"utf8");console.log("Wrote data/tag-classification-candidates.json");}
  else{
    const current=await readFile(outputPath,"utf8").catch(()=>"");
    if(current!==serialized){console.error("ERROR: classification candidates are stale. Run with --write.");process.exitCode=1;}
    else console.log("Classification candidate report is up to date.");
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
