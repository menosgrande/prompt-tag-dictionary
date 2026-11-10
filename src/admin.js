(() => {
"use strict";
const $ = s => document.querySelector(s), DRAFT_KEY = "ptd.admin.draft.v1", LAYOUT_KEY = "ptd.admin.layout.v1", PAGE_SIZE = 100;
const STATUS_LABEL = {unreviewed:"未確認","needs-review":"要確認",verified:"確認済み",provisional:"暫定","machine-translation":"機械翻訳","not-applicable":"対象外"};
const state = {dictionary:null,tags:[],promptOrder:null,selected:null,page:0,query:"",filter:"all",sort:"source",dirty:false,sourceFingerprint:""};
 let initialPromptOrder = null;
const norm = s => String(s ?? "").normalize("NFKC").toLocaleLowerCase().trim(), today = () => new Date().toISOString().slice(0,10);
function fingerprintSource(bundle){const source=JSON.stringify(bundle);let hash=2166136261;for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619);}return "ptd-v1-"+(hash>>>0).toString(16);}
function split(row){return {tag:String(row[0]??""),ja:String(row[1]??""),major:String(row[2]??"未分類"),minor:String(row[3]??"未分類"),detail:String(row[4]??""),aliases:Array.isArray(row[5])?row[5]:String(row[5]??"").split(",").map(s=>s.trim()).filter(Boolean)};}
function current(){return state.tags.find(t=>t[0]===state.selected);}
function metadataFor(tag){const row=state.tags.find(item=>item[0]===tag),meta=row?.[6];return meta&&typeof meta==="object"&&!Array.isArray(meta)?meta:{};}
function entryFor(tag){const meta=metadataFor(tag),candidate=state.dictionary?.classificationCandidates?.entries?.find(item=>item.tag===tag);return {translationStatus:meta.translation?.status||"unreviewed",classificationStatus:candidate?.status||meta.classificationReview?.status||meta.classification?.status||"unreviewed",reviewedAt:meta.translation?.reviewedAt||meta.classificationReview?.reviewedAt||null,note:candidate?.reason||meta.classificationReview?.reason||meta.translation?.reviewNote||"",source:meta.translation?.source||meta.classificationReview?.source||null};}
function entry(){return entryFor(state.selected);}
function statusFor(tag){const e=entryFor(tag);if(e.translationStatus==="needs-review"||e.classificationStatus==="needs-review")return "needs-review";if(e.translationStatus==="verified"&&e.classificationStatus==="verified")return "verified";if(e.classificationStatus==="provisional")return "provisional";return "unreviewed";}
function matches(){const q=norm(state.query),rows=state.tags.filter(row=>{const t=split(row),text=norm([t.tag,t.ja,t.major,t.minor,t.detail,...t.aliases].join(" "));if(q&&!text.includes(q))return false;if(state.filter!=="all"&&statusFor(t.tag)!==state.filter)return false;return true;});if(state.sort==="category"){const cmpCategory=(a,b)=>{const au=!a||a==="未分類",bu=!b||b==="未分類";if(au!==bu)return au?1:-1;return a.localeCompare(b,"ja");};rows.sort((a,b)=>{const x=split(a),y=split(b);return cmpCategory(x.major,y.major)||cmpCategory(x.minor,y.minor)||x.tag.localeCompare(y.tag,"en");});}else if(state.sort==="tag"){rows.sort((a,b)=>split(a).tag.localeCompare(split(b).tag,"en"));}return rows;}
function initResizer(){
 const layout=$(".layout"),list=$("#results"),resizer=$("#list-resizer"),card=$(".tag-list-card");
 if(!layout||!list||!resizer||!card)return;
 const mobile=()=>window.matchMedia("(max-width: 850px)").matches;
 try{const saved=JSON.parse(localStorage.getItem(LAYOUT_KEY)||"{}");if(Number.isFinite(saved.width)&&saved.width>=240)layout.style.setProperty("--list-pane-width",saved.width+"px");if(Number.isFinite(saved.height)&&saved.height>=180)layout.style.setProperty("--list-pane-height",saved.height+"px");}catch(_){}
 const save=()=>{try{const saved=JSON.parse(localStorage.getItem(LAYOUT_KEY)||"{}");if(!mobile())saved.width=Math.round(card.getBoundingClientRect().width+8);saved.height=Math.round(list.getBoundingClientRect().height);localStorage.setItem(LAYOUT_KEY,JSON.stringify(saved));}catch(_){}};
 let dragging=false;
 resizer.addEventListener("pointerdown",e=>{if(mobile())return;dragging=true;resizer.classList.add("dragging");resizer.setPointerCapture(e.pointerId);e.preventDefault();});
 resizer.addEventListener("pointermove",e=>{if(!dragging)return;const rect=layout.getBoundingClientRect(),max=Math.max(240,rect.width-340);layout.style.setProperty("--list-pane-width",Math.max(240,Math.min(max,e.clientX-rect.left))+"px");});
 const stop=()=>{if(!dragging)return;dragging=false;resizer.classList.remove("dragging");save();};
 resizer.addEventListener("pointerup",stop);resizer.addEventListener("pointercancel",stop);
 resizer.addEventListener("keydown",e=>{if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;e.preventDefault();const current=card.getBoundingClientRect().width,max=Math.max(240,layout.clientWidth-340);layout.style.setProperty("--list-pane-width",Math.max(240,Math.min(max,current+(e.key==="ArrowRight"?20:-20)))+"px");save();});
 if("ResizeObserver"in window){let timer;new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(save,250);}).observe(list);}
}


function renderPromptOrder(){
 const root=$("#prompt-order-list");if(!root)return;root.replaceChildren();
 state.promptOrder.categories.forEach((category,index)=>{
  const li=document.createElement("li"),label=document.createElement("div"),name=document.createElement("strong"),purpose=document.createElement("small"),controls=document.createElement("div"),up=document.createElement("button"),down=document.createElement("button");
  li.className="prompt-order-item";name.textContent=category.name;purpose.textContent=category.purpose||"";
  label.className="prompt-order-label";label.append(name,purpose);controls.className="prompt-order-controls";
  up.type=down.type="button";up.textContent="↑";down.textContent="↓";up.title="上へ";down.title="下へ";up.disabled=index===0;down.disabled=index===state.promptOrder.categories.length-1;
  up.addEventListener("click",()=>movePromptCategory(index,-1));down.addEventListener("click",()=>movePromptCategory(index,1));
  controls.append(up,down);li.append(label,controls);root.append(li);
 });
 $("#prompt-order-count").textContent=state.promptOrder.categories.length+"カテゴリ";
}
function movePromptCategory(index,delta){
 const next=index+delta;if(next<0||next>=state.promptOrder.categories.length)return;
 const rows=state.promptOrder.categories;[rows[index],rows[next]]=[rows[next],rows[index]];
 rows.forEach((row,i)=>row.order=i+1);persist();renderPromptOrder();
 $("#prompt-order-status").textContent="並び順をこの端末に保存しました。正本JSONを出力すると反映できます。";
}
function resetPromptOrder(){
 if(!initialPromptOrder){$("#prompt-order-status").textContent="初期順を復元できません。ページを再読み込みしてください。";return;}
 state.promptOrder=JSON.parse(JSON.stringify(initialPromptOrder));
 persist();renderPromptOrder();$("#prompt-order-status").textContent="読み込み時のカテゴリ順に戻しました。";
}
function exportPromptOrder(){exportDictionary();}
function exportDictionary(){if(state.dirty){$("#export-status").textContent="未保存の入力があります。先に「変更を保存」を押してください。";return;}state.dictionary.tags=state.tags;state.dictionary.promptOrder=state.promptOrder;download("dictionary-data.json",state.dictionary);$("#export-status").textContent="正本 dictionary-data.json を出力しました。これだけを更新してください。";}


function renderList(){const all=matches(),pages=Math.max(1,Math.ceil(all.length/PAGE_SIZE));state.page=Math.min(state.page,pages-1);const start=state.page*PAGE_SIZE,root=$("#results");root.replaceChildren();all.slice(start,start+PAGE_SIZE).forEach(row=>{const t=split(row),b=document.createElement("button");b.type="button";b.className="tag-item"+(state.selected===t.tag?" active":"");const strong=document.createElement("strong");strong.textContent=t.tag;const small=document.createElement("small"),meta=row[6]||{},level=Number.isInteger(meta.expressionLevel)&&meta.expressionLevel>=0&&meta.expressionLevel<=4?"表現レベル"+meta.expressionLevel+"（"+["一般向け","軽度の露出","セクシー表現","強い性的表現","成人向け"][meta.expressionLevel]+"）":"表現レベル未判定";small.textContent=(t.ja||"（訳なし）")+" · "+t.major+" › "+t.minor+" · "+level;const badge=document.createElement("em");badge.textContent=STATUS_LABEL[statusFor(t.tag)]||"未確認";b.append(strong,small,badge);b.addEventListener("click",()=>selectTag(t.tag));root.append(b);});$("#count").textContent=all.length.toLocaleString("ja-JP")+"件";$("#page").textContent=all.length?String(start+1)+"–"+Math.min(start+PAGE_SIZE,all.length)+" / "+all.length+"（"+(state.page+1)+"/"+pages+"）":"0件";$("#prev").disabled=state.page===0;$("#next").disabled=state.page>=pages-1;}
function readForm(){return {tag:$("#tag").value.trim(),ja:$("#ja").value,major:$("#major-select").value.trim()||"未分類",minor:$("#minor-select").value.trim()||"未分類",detail:$("#detail-select").value.trim(),aliases:[...new Set($("#aliases").value.split(",").map(s=>s.trim()).filter(Boolean))],translationStatus:$("#translation-status").value,classificationStatus:$("#classification-status").value,expressionLevel:$("#expression-level").value,expressionLevelReason:$("#expression-level-reason").value.trim(),reason:$("#reason").value.trim(),source:$("#source").value.trim()||null};}
function baseline(){const row=current();if(!row)return null;const e=entry(),meta=metadataFor(row[0]);return {tag:row[0]||"",ja:row[1]||"",major:row[2]||"未分類",minor:row[3]||"未分類",detail:row[4]||"",aliases:Array.isArray(row[5])?row[5]:String(row[5]??"").split(",").map(s=>s.trim()).filter(Boolean),translationStatus:e.translationStatus||"unreviewed",classificationStatus:e.classificationStatus||"unreviewed",expressionLevel:Number.isInteger(meta.expressionLevel)?String(meta.expressionLevel):"",expressionLevelReason:meta.expressionLevelReview?.reason||"",reason:e.note||"",source:e.source||null};}
function renderDiff(){const before=baseline(),after=readForm();if(!before){$("#diff").textContent="タグを選択してください。";return;}const keys=[["tag","英語タグ名"],["ja","日本語訳"],["major","大分類"],["minor","小分類"],["detail","詳細分類"],["aliases","別名"],["translationStatus","翻訳状態"],["classificationStatus","分類状態"],["expressionLevel","表現レベル"],["expressionLevelReason","表現レベルの判定根拠"],["reason","修正理由"],["source","出典"]],changes=keys.filter(([k])=>String(before[k]??"")!==String(after[k]??""));$("#diff").textContent=changes.length?changes.map(([k,label])=>label+"\n  変更前: "+(before[k]||"（空）")+"\n  変更後: "+(after[k]||"（空）")).join("\n\n"):"変更はありません。";}
function ensureCategoryOption(id,value){const el=$("#"+id);if(value&&!Array.from(el.options).some(o=>o.value===value)){const o=document.createElement("option");o.value=value;o.textContent=value+"（既存データ）";el.insertBefore(o,el.lastElementChild);}}
function selectTag(tag){if(state.dirty&&!confirm("未保存の入力があります。破棄して別のタグを開きますか？"))return;state.selected=tag;state.dirty=false;const row=current(),e=entry(),t=split(row);$("#selected-name").textContent=tag;$("#tag").value=row[0]||"";$("#ja").value=row[1]||"";ensureCategoryOption("major-select",row[2]||"未分類");ensureCategoryOption("minor-select",row[3]||"未分類");ensureCategoryOption("detail-select",t.detail);$("#major-select").value=row[2]||"未分類";$("#minor-select").value=row[3]||"未分類";$("#detail-select").value=t.detail;$("#aliases").value=t.aliases.join(", ");$("#translation-status").value=e.translationStatus||"unreviewed";$("#classification-status").value=e.classificationStatus||"unreviewed";$("#reason").value=e.note||"";$("#source").value=e.source||"";const meta=metadataFor(tag);$("#expression-level").value=Number.isInteger(meta.expressionLevel)?String(meta.expressionLevel):"";$("#expression-level-reason").value=meta.expressionLevelReview?.reason||"";$("#save").disabled=false;$("#reset").disabled=false;$("#status").textContent="";renderDiff();renderList();}
function markDirty(){state.dirty=true;renderDiff();}
function syncClassificationCandidate(tag, meta, status){
 const candidates=state.dictionary.classificationCandidates||(state.dictionary.classificationCandidates={entries:[]});
 const entries=Array.isArray(candidates.entries)?candidates.entries:(candidates.entries=[]);
 const key=norm(tag),index=entries.findIndex(item=>norm(item?.tag)===key);
 let classification=meta.classification&&typeof meta.classification==="object"&&!Array.isArray(meta.classification)?meta.classification:null;
 if(!classification&&index>=0){
  const {tag:ignoredTag,...candidate}=entries[index];
  classification=candidate;
 }
 if(status==="verified"){
  delete meta.classification;
  if(index>=0)entries.splice(index,1);
  return;
 }
 if(status==="needs-review"||status==="provisional"){
  if(!classification&&status==="needs-review")classification={};
  if(!classification)return;
  classification.status=status;
  meta.classification=classification;
  const candidate={tag,...classification};
  if(index>=0)entries[index]=candidate;else entries.push(candidate);
 }
}
function save(){
 const row=current();if(!row)return;
 const before=baseline(),form=readForm();
 if(!form.tag){$("#status").textContent="英語タグ名を入力してください。";return;}
 const oldKey=state.selected,newKey=form.tag;
 if(state.tags.some(r=>r!==row&&norm(r[0])===norm(newKey))){$("#status").textContent="同じ英語タグ名が既にあります。";return;}
 const changed=["tag","ja","major","minor","detail","aliases","expressionLevel","expressionLevelReason"].some(k=>JSON.stringify(before[k]??"")!==JSON.stringify(form[k]??""));
 const entryChanged=before.translationStatus!==form.translationStatus||before.classificationStatus!==form.classificationStatus||before.expressionLevelReason!==form.expressionLevelReason||before.reason!==form.reason||String(before.source??"")!==String(form.source??"");
 if(!changed&&!entryChanged){$("#status").textContent="変更はありません。";return;}
 row[0]=newKey;row[1]=form.ja;row[2]=form.major;row[3]=form.minor;row[4]=form.detail;row[5]=form.aliases;
 const meta=row[6]&&typeof row[6]==="object"&&!Array.isArray(row[6])?row[6]:(row[6]={});
 meta.translation={...(meta.translation||{}),status:form.translationStatus,candidateJa:form.ja,source:form.source||meta.translation?.source||null};
 if(form.expressionLevel===""){delete meta.expressionLevel;meta.expressionLevelReview={status:"unreviewed",...(form.expressionLevelReason?{reason:form.expressionLevelReason}:{})};}
 else {const level=Number(form.expressionLevel);if(!Number.isInteger(level)||level<0||level>4)throw new Error("表現レベルは0〜4で指定してください");meta.expressionLevel=level;meta.expressionLevelReview={status:"verified",reason:form.expressionLevelReason||"タグ単体の意味に基づく判定。",reviewedAt:today()};}
 meta.classificationReview={...(meta.classificationReview||{}),status:form.classificationStatus,reason:form.reason||null,source:form.source||meta.classificationReview?.source||null,reviewedAt:(form.translationStatus==="verified"||form.classificationStatus==="verified")?today():(meta.classificationReview?.reviewedAt||null)};
 syncClassificationCandidate(oldKey,meta,form.classificationStatus);
 if(oldKey!==newKey){
  for(const item of state.dictionary.classificationCandidates?.entries||[])if(item.tag===oldKey)item.tag=newKey;
  for(const item of state.dictionary.nsfwAudit?.candidates||[])if(item.tag===oldKey)item.tag=newKey;
  for(const item of state.promptOrder.overrides||[])if(item.tag===oldKey)item.tag=newKey;
  for(const group of state.dictionary.tagGroups||[]){group.members=(group.members||[]).map(tag=>tag===oldKey?newKey:tag);if(group.titleTag===oldKey)group.titleTag=newKey;}
 }
 state.dictionary.tags=state.tags;state.dictionary.promptOrder=state.promptOrder;
 state.selected=newKey;state.dirty=false;persist();
 $("#selected-name").textContent=newKey;renderList();renderDiff();
 $("#status").textContent="この端末に保存しました。正本JSONを出力するまで公開データは変更されません。";
}
function persist(){try{state.dictionary.tags=state.tags;state.dictionary.promptOrder=state.promptOrder;const draft={schema:state.dictionary.schema,tags:state.tags,promptOrder:state.promptOrder,classificationCandidates:state.dictionary.classificationCandidates};localStorage.setItem(DRAFT_KEY,JSON.stringify({sourceFingerprint:state.sourceFingerprint,dictionary:draft}));}catch(e){$("#status").textContent="保存に失敗しました。ブラウザの保存容量を確認してください。";}}
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);}
async function init(){try{const bundleRes=await fetch("./data/dictionary-data.json");if(!bundleRes.ok)throw new Error("dictionary-data.json を読み込めません");const bundle=await bundleRes.json();if(bundle.schema!=="prompt-tag-dictionary-runtime-v1"||!Array.isArray(bundle.tags)||!bundle.promptOrder||!Array.isArray(bundle.promptOrder.categories))throw new Error("正本辞書データの形式が不正です");state.dictionary=bundle;state.tags=bundle.tags;state.promptOrder=bundle.promptOrder;initialPromptOrder=JSON.parse(JSON.stringify(bundle.promptOrder));state.sourceFingerprint=fingerprintSource(bundle);state.promptOrder.categories.sort((a,b)=>(a.order||999)-(b.order||999));const raw=localStorage.getItem(DRAFT_KEY);if(raw){const d=JSON.parse(raw);if(d.dictionary?.schema===bundle.schema&&Array.isArray(d.dictionary.tags)&&d.sourceFingerprint===state.sourceFingerprint){state.dictionary={...bundle,...d.dictionary};state.tags=d.dictionary.tags;state.promptOrder=d.dictionary.promptOrder;state.promptOrder.categories.sort((a,b)=>(a.order||999)-(b.order||999));$("#status").textContent="前回のローカル編集を復元しました。";}else{try{localStorage.setItem("ptd.admin.stale-draft.v1",raw);}catch(_){}$("#status").textContent="古いローカル編集は最新データと一致しないため復元しませんでした。旧データはこの端末に退避しています。";}}initResizer();const fillOptions=(id,values,blank=false)=>{const el=$("#"+id),opts=[...new Set(values.map(v=>String(v||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja")).map(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;return o;});el.replaceChildren();if(blank){const o=document.createElement("option");o.value="";o.textContent="（なし）";el.append(o);}el.append(...opts);const custom=document.createElement("option");custom.value="__new__";custom.textContent="＋ 新しい分類を入力…";el.append(custom);};fillOptions("major-select",state.tags.map(r=>r[2]));fillOptions("minor-select",state.tags.map(r=>r[3]));fillOptions("detail-select",state.tags.map(r=>r[4]),true);["major-select","minor-select","detail-select"].forEach(id=>$("#"+id).addEventListener("change",e=>{if(e.target.value!=="__new__")return;const value=prompt("追加する分類名を入力してください。");if(value&&value.trim()){const v=value.trim(),el=e.target;ensureCategoryOption(id,v);el.value=v;markDirty();}else{const previous=Array.from(e.target.options).find(o=>o.value!=="__new__");e.target.value=previous?previous.value:"";}}));$("#search").addEventListener("input",e=>{state.query=e.target.value;state.page=0;renderList();});$("#filter").addEventListener("change",e=>{state.filter=e.target.value;state.page=0;renderList();});$("#sort").addEventListener("change",e=>{state.sort=e.target.value;state.page=0;renderList();});$("#prev").addEventListener("click",()=>{state.page=Math.max(0,state.page-1);renderList();});$("#next").addEventListener("click",()=>{state.page++;renderList();});["tag","ja","aliases","reason","source","expression-level-reason"].forEach(id=>$("#"+id).addEventListener("input",markDirty));["major-select","minor-select","detail-select","translation-status","classification-status","expression-level"].forEach(id=>$("#"+id).addEventListener("change",markDirty));$("#save").addEventListener("click",save);$("#reset").addEventListener("click",()=>{if(state.selected)selectTag(state.selected);});$("#export-dictionary").addEventListener("click",exportDictionary);$("#prompt-order-reset").addEventListener("click",resetPromptOrder);$("#discard").addEventListener("click",async()=>{if(!confirm("この端末に保存された管理画面の編集とバッチ進捗をすべて破棄しますか？出力済みファイルは削除されません。"))return;localStorage.removeItem(DRAFT_KEY);localStorage.removeItem("ptd.admin.stale-draft.v1");await batchStore("delete").catch(()=>{});location.reload();});initBatchTools();renderList();renderPromptOrder();}catch(e){$("#count").textContent="読み込み失敗";$("#results").textContent=e.message+"。GitHub Pages上またはローカルサーバーから開いてください。";}}

const CSV_HEADERS=["index","tag","ja","major","minor","detail","aliases_json","translation_status","expression_level","expression_level_review_status","classification_review_status"];
const BATCH_DB="ptd-admin-batch-v1";
let activeBatch=null;
function csvCell(value){const text=value===null||value===undefined?"":String(value);return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;}
function csvText(rows){return "\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";}
function csvParse(source){
 const text=source.replace(/^\uFEFF/,""),rows=[];let row=[],cell="",quoted=false,afterQuote=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=ch;continue;}
 if(afterQuote&&ch!==","&&ch!=="\n"&&ch!=="\r")throw new Error("閉じ引用符の後に不正な文字があります。");
 if(ch==='"'){if(cell!==""||afterQuote)throw new Error("CSVの引用符が不正です。");quoted=true;}
 else if(ch===","){row.push(cell);cell="";afterQuote=false;}
 else if(ch==="\n"){row.push(cell);rows.push(row);row=[];cell="";afterQuote=false;}
 else if(ch==="\r"){if(text[i+1]==="\n")continue;row.push(cell);rows.push(row);row=[];cell="";afterQuote=false;}
 else cell+=ch;
 }
 if(quoted)throw new Error("CSVの引用符が閉じられていません。");
 if(cell!==""||row.length||afterQuote){row.push(cell);rows.push(row);}
 if(rows.length&&rows.at(-1).every(v=>v===""))rows.pop();return rows;
}
function csvRowFor(index,row){
 const meta=row[6]||{};
 return [String(index),row[0],row[1],row[2],row[3],row[4]??"",row[5]==null?"":JSON.stringify(row[5]),meta.translation?.status??"",meta.expressionLevel??"",meta.expressionLevelReview?.status??"",meta.classificationReview?.status??""];
}
function downloadCsv(name,rows){const blob=new Blob(["\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openBatchDb(){return new Promise((resolve,reject)=>{if(!("indexedDB"in window)){reject(new Error("このブラウザはIndexedDBに対応していません。"));return;}const req=indexedDB.open("ptd-admin-workspace",1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("state"))req.result.createObjectStore("state");};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("作業領域を開けません"));});}
async function batchStore(mode,value){const db=await openBatchDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction("state",mode==="get"?"readonly":"readwrite"),store=tx.objectStore("state"),req=mode==="get"?store.get(BATCH_DB):mode==="delete"?store.delete(BATCH_DB):store.put(value,BATCH_DB);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("作業状態を保存できません"));tx.onerror=()=>reject(tx.error||new Error("作業状態の保存に失敗しました"));});}finally{db.close();}}
function statusOf(tag,task){
 const meta=metadataFor(tag),tr=meta.translation?.status||"unreviewed",cl=meta.classificationReview?.status||meta.classification?.status||"unreviewed",ex=meta.expressionLevelReview?.status||"unreviewed";
 const done=s=>s==="verified"||s==="not-applicable";
 if(task==="translation")return tr;
 if(task==="classification")return cl;
 if(task==="expressionLevel")return ex;
 return [tr,cl,ex].every(done)?"verified":[tr,cl,ex].includes("needs-review")?"needs-review":"unreviewed";
}
function batchTarget(tag,task,scope){
 const statuses=task==="all"?["translation","classification","expressionLevel"].map(t=>statusOf(tag,t)):[statusOf(tag,task)];
 if(scope==="all")return true;
 if(scope==="needs-review")return statuses.includes("needs-review");
 return statuses.some(s=>s!=="verified"&&s!=="not-applicable");
}
function updateBatchProgress(){
 const counts={translation:0,classification:0,expressionLevel:0,all:0};
 for(const row of state.tags)for(const task of Object.keys(counts))if(batchTarget(row[0],task,"pending"))counts[task]++;
 $("#batch-total").textContent=state.tags.length.toLocaleString("ja-JP")+"タグ";
 const done=activeBatch?.completedTags?.length||0,total=activeBatch?.entries?.length||0;
 $("#batch-progress").textContent=activeBatch
  ?"進行中："+activeBatch.batchId+" / "+activeBatch.task+" / 取り込み "+done+"件 / 対象 "+total+"件 / 残り "+(total-done)+"件"
  :"未完了：翻訳 "+counts.translation+"件・分類 "+counts.classification+"件・表現レベル "+counts.expressionLevel+"件・総合 "+counts.all+"件。";
}
async function initBatchTools(){
 $("#batch-export").addEventListener("click",exportNextBatch);
 $("#batch-import").addEventListener("click",importBatchFile);$("#batch-copy-prompt").addEventListener("click",copyBatchPrompt);
 $("#batch-file").addEventListener("change",e=>{$("#batch-import").disabled=!e.target.files?.length;});
 $("#batch-clear").addEventListener("click",async()=>{if(activeBatch&&!confirm("現在のバッチ進捗を解除しますか？取り込み済みの辞書編集は残ります。"))return;activeBatch=null;await batchStore("delete");updateBatchProgress();$("#batch-status").textContent="現在のバッチを解除しました。";});
 $("#csv-export-all").addEventListener("click",()=>{if(state.dirty){$("#batch-status").textContent="未保存の編集があります。先に変更を保存してください。";return;}const rows=[CSV_HEADERS,...state.tags.map((row,index)=>csvRowFor(index,row))];downloadCsv("dictionary-working.csv",rows);$("#batch-status").textContent="全件CSVを出力しました。GitHubの exports/dictionary-working.csv と置き換えてください。";});
 try{activeBatch=await batchStore("get")||null;}catch(e){$("#batch-status").textContent="作業状態を読み込めません: "+e.message;}
 updateBatchProgress();
}
function createBatch(){
 const task=$("#batch-task").value,scope=$("#batch-scope").value,size=Number($("#batch-size").value);
 const picked=state.tags.map((row,index)=>({row,index})).filter(x=>batchTarget(x.row[0],task,scope)).slice(0,size);
 if(!picked.length)throw new Error("条件に合うタグはありません。");
 const batchId="csv-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);
 return {schema:"ptd-csv-batch-v1",batchId,sourceFingerprint:state.sourceFingerprint,task,scope,createdAt:new Date().toISOString(),completedTags:[],entries:picked.map(({row,index})=>({index,tag:row[0],snapshot:csvRowFor(index,row)}))};
}
async function exportNextBatch(){
 try{
  if(state.dirty)throw new Error("編集中の入力を先に保存または破棄してください。");
  if(activeBatch&&activeBatch.completedTags.length<activeBatch.entries.length){
   const remaining=activeBatch.entries.filter(e=>!activeBatch.completedTags.includes(e.tag));
   const rows=[CSV_HEADERS,...remaining.map(e=>e.snapshot)];
   downloadCsv("dictionary-"+activeBatch.batchId+"-remaining.csv",rows);
   $("#batch-status").textContent="未取り込みの "+remaining.length+" 件を再出力しました。";
   return;
  }
  activeBatch=createBatch();await batchStore("put",activeBatch);
  downloadCsv("dictionary-"+activeBatch.batchId+".csv",[CSV_HEADERS,...activeBatch.entries.map(e=>e.snapshot)]);
  $("#batch-status").textContent=activeBatch.entries.length+"件のCSVバッチを出力しました。編集後のCSVを戻してください。";
  updateBatchProgress();
 }catch(e){$("#batch-status").textContent="出力できません: "+e.message;}
}
function classificationIds(major,minor,tag){
 const category=state.dictionary.taxonomy?.semanticCategories?.find(x=>x.name===major);
 const sub=category?.subcategories?.find(x=>x.name===minor);
 if(!category||!sub)throw new Error("分類がtaxonomyにありません: "+tag+" ("+major+" / "+minor+")");
 return {categoryId:category.id,subcategoryId:sub.id};
}
function applyBatchRow(entry,cells,task){
 const row=state.tags[entry.index],meta=row[6]&&typeof row[6]==="object"?row[6]:(row[6]={}),oldMajor=row[2],oldMinor=row[3];
 if(task==="translation"||task==="all"){
  row[1]=cells[2];
  const status=cells[7];if(status&&!["verified","needs-review","unreviewed","machine-translation","not-applicable"].includes(status))throw new Error("翻訳状態が不正です: "+row[0]);
  meta.translation={...(meta.translation||{})};if(status)meta.translation.status=status;else delete meta.translation.status;meta.translation.candidateJa=row[1];
 }
 if(task==="classification"||task==="all"){
  row[2]=cells[3];row[3]=cells[4];
  if(cells[5]==="__CLEAR__")row[4]=null;else if(cells[5]!=="")row[4]=cells[5];
  if(cells[6]!==""){let aliases;try{aliases=JSON.parse(cells[6]);}catch{throw new Error("aliases_jsonのJSONが不正です: "+row[0]);}if(!Array.isArray(aliases)||aliases.some(x=>typeof x!=="string"))throw new Error("aliases_jsonは文字列配列で指定してください: "+row[0]);row[5]=aliases;}
  const status=cells[10];if(status&&!["verified","needs-review","provisional","unreviewed","not-applicable"].includes(status))throw new Error("分類状態が不正です: "+row[0]);
  meta.classificationReview={...(meta.classificationReview||{})};if(status)meta.classificationReview.status=status;else delete meta.classificationReview.status;
  if(oldMajor!==row[2]||oldMinor!==row[3]){
   if(meta.classification){if((row[2]==="未分類"&&row[3]==="未分類")||(row[2]==="要確認"&&row[3]==="要確認"))delete meta.classification;else Object.assign(meta.classification,classificationIds(row[2],row[3],row[0]));}
  }
  const entries=state.dictionary.classificationCandidates?.entries;
  const idx=Array.isArray(entries)?entries.findIndex(x=>x.tag===row[0]):-1;
  let classification=meta.classification&&typeof meta.classification==="object"?{...meta.classification}:idx>=0?(()=>{const {tag:ignored,...rest}=entries[idx];return {...rest};})():null;
  const classificationChanged=oldMajor!==row[2]||oldMinor!==row[3];
  if(classificationChanged&&classification){
   if((row[2]==="未分類"&&row[3]==="未分類")||(row[2]==="要確認"&&row[3]==="要確認"))classification=null;
   else Object.assign(classification,classificationIds(row[2],row[3],row[0]));
  }
  if(classificationChanged&&!classification&&status!=="needs-review"&&status!=="provisional"){delete meta.classification;if(idx>=0)entries.splice(idx,1);}
  if(status==="verified"||status==="not-applicable"){
   if(idx>=0)entries.splice(idx,1);
   delete meta.classification;
  }else if(status==="needs-review"||status==="provisional"){
   classification=classification||{};
   classification.status=status;
   if(row[2]!=="未分類"&&row[3]!=="未分類")Object.assign(classification,classificationIds(row[2],row[3],row[0]));
   meta.classification=classification;
   if(Array.isArray(entries)){const item={tag:row[0],...classification};if(idx>=0)entries[idx]=item;else entries.push(item);}
  }else if(classificationChanged&&classification){
   meta.classification=classification;
   if(Array.isArray(entries)&&idx>=0)entries[idx]={tag:row[0],...classification};
  }
 }
 if(task==="expressionLevel"||task==="all"){
  if(cells[8]==="__CLEAR__"){delete meta.expressionLevel;}else if(cells[8]!==""){if(!/^[0-4]$/.test(cells[8]))throw new Error("expression_levelは0〜4です: "+row[0]);meta.expressionLevel=Number(cells[8]);}
  const status=cells[9];if(status&&!["verified","needs-review","provisional","unreviewed","not-applicable"].includes(status))throw new Error("表現レベル状態が不正です: "+row[0]);
  meta.expressionLevelReview={...(meta.expressionLevelReview||{})};if(status)meta.expressionLevelReview.status=status;else delete meta.expressionLevelReview.status;
 }
 if(!Object.keys(meta.translation||{}).length)delete meta.translation;
 if(!Object.keys(meta.classificationReview||{}).length)delete meta.classificationReview;
 if(!Object.keys(meta.expressionLevelReview||{}).length)delete meta.expressionLevelReview;
}

async function copyBatchPrompt(){
 const task=$("#batch-task").value;
 const names={translation:"日本語訳と翻訳確認状態",classification:"大分類・小分類・詳細分類と分類確認状態",expressionLevel:"表現レベルと確認状態",all:"翻訳・分類・表現レベル"};
 const fields={translation:"ja, translation_status",classification:"major, minor, detail, classification_review_status",expressionLevel:"expression_level, expression_level_review_status",all:"ja, major, minor, detail, aliases_json, translation_status, expression_level, expression_level_review_status, classification_review_status"};
 const prompt="添付CSVのタグデータを「"+names[task]+"」について整備してください。\n\n厳守事項:\n- CSVのヘッダー11列、行数、行順、index、tagを絶対に変更しない。\n- 編集してよい列は次だけ: "+fields[task]+"。他の列は元の値を完全に維持する。\n- 英文tagは識別子なので変更しない。行の追加・削除・並べ替え・重複作成をしない。\n- 意味・作品名・媒体・分類を確実に判断できない場合は推測せず、該当する確認状態を needs-review にする。\n- 正しい日本語訳・分類は無理に変更しない。既存の値を尊重する。\n- 翻訳・分類・表現レベルの確認状態を混同しない。対象外の確認状態を変更しない。\n- expression_level は確認できた場合のみ0〜4。未判定は空欄のままにし、0を代入しない。\n- CSVの引用符・カンマ・改行を正しくエスケープする。\n- 返答は編集済みCSVファイルのみ。Markdownコードフェンスや説明文をCSVに混ぜない。\n\n現在のバッチID: "+(activeBatch?.batchId||"未作成")+"。CSVの行をすべて保持して返してください。";
 try{await navigator.clipboard.writeText(prompt);$("#batch-status").textContent="AI向け指示をコピーしました。CSVファイルと一緒にChatGPTへ渡してください。";}
 catch(e){$("#batch-status").textContent="クリップボードへコピーできません。ブラウザの権限を確認してください。";}
}

async function importBatchFile(){
 const file=$("#batch-file").files?.[0];if(!file)return;
 try{
  if(!activeBatch)throw new Error("有効なバッチがありません。先にCSVを出力してください。");
  if(activeBatch.sourceFingerprint!==state.sourceFingerprint)throw new Error("正本データがバッチ作成時から変わっています。最新データでバッチを作り直してください。");
  const records=csvParse(await file.text());
  if(!records.length||JSON.stringify(records[0])!==JSON.stringify(CSV_HEADERS))throw new Error("CSVヘッダーが現行11列と一致しません。");
  const map=new Map(activeBatch.entries.map(e=>[e.tag,e])),seen=new Set(),parsed=[];
  const editable=activeBatch.task==="translation"?new Set([2,7]):activeBatch.task==="classification"?new Set([3,4,5,6,10]):activeBatch.task==="expressionLevel"?new Set([8,9]):new Set([2,3,4,5,6,7,8,9,10]);
  for(let n=1;n<records.length;n++){
   const cells=records[n];if(cells.length!==CSV_HEADERS.length)throw new Error("CSV "+(n+1)+"行目の列数が11列ではありません。");
   const index=Number(cells[0]),tag=cells[1],entry=map.get(tag);
   if(!Number.isInteger(index)||!entry||entry.index!==index||state.tags[index]?.[0]!==tag||seen.has(tag))throw new Error("index/tagの不一致、対象外タグ、または重複があります: "+tag);
   if(activeBatch.completedTags.includes(tag))throw new Error("すでに取り込み済みのタグが含まれています。未処理分CSVを出力してください: "+tag);
   if(JSON.stringify(csvRowFor(index,state.tags[index]))!==JSON.stringify(entry.snapshot))throw new Error("バッチ作成後に辞書側が変更されています。競合を解消してから再出力してください: "+tag);
   for(let col=0;col<cells.length;col++)if(col!==0&&col!==1&&!editable.has(col)&&cells[col]!==entry.snapshot[col])throw new Error("作業対象外の列が変更されています: "+tag+" / "+CSV_HEADERS[col]);
   seen.add(tag);parsed.push({entry,cells});
  }
  if(!parsed.length)throw new Error("取り込めるデータ行がありません。");
  const oldTags=state.tags,oldCandidates=state.dictionary.classificationCandidates;
  state.tags=structuredClone(state.tags);state.dictionary.tags=state.tags;state.dictionary.classificationCandidates=structuredClone(oldCandidates||{entries:[]});
  try{for(const {entry,cells} of parsed)applyBatchRow(entry,cells,activeBatch.task);}
  catch(error){state.tags=oldTags;state.dictionary.tags=oldTags;state.dictionary.classificationCandidates=oldCandidates;throw error;}
  const completedBefore=activeBatch.completedTags.slice();
  activeBatch.completedTags=[...new Set([...activeBatch.completedTags,...parsed.map(x=>x.entry.tag)])];
  try{await batchStore("put",activeBatch);}
  catch(error){state.tags=oldTags;state.dictionary.tags=oldTags;state.dictionary.classificationCandidates=oldCandidates;activeBatch.completedTags=completedBefore;throw new Error("作業進捗の保存に失敗したため、今回の取り込みを取り消しました: "+error.message);}
  state.dictionary.tags=state.tags;persist();
  renderList();if(state.selected)selectTag(state.selected);
  $("#batch-status").textContent=parsed.length+"件を検証して取り込みました。全件CSVを出力し、exports/dictionary-working.csvへ反映してください。";
  $("#batch-file").value="";$("#batch-import").disabled=true;updateBatchProgress();
 }catch(e){$("#batch-status").textContent="取り込みを中止しました。辞書データは変更していません。理由: "+e.message;}
}

init();
})();