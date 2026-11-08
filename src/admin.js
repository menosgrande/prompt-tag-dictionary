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
async function init(){try{const bundleRes=await fetch("./data/dictionary-data.json");if(!bundleRes.ok)throw new Error("dictionary-data.json を読み込めません");const bundle=await bundleRes.json();if(bundle.schema!=="prompt-tag-dictionary-runtime-v1"||!Array.isArray(bundle.tags)||!bundle.promptOrder||!Array.isArray(bundle.promptOrder.categories))throw new Error("正本辞書データの形式が不正です");state.dictionary=bundle;state.tags=bundle.tags;state.promptOrder=bundle.promptOrder;initialPromptOrder=JSON.parse(JSON.stringify(bundle.promptOrder));state.sourceFingerprint=fingerprintSource(bundle);state.promptOrder.categories.sort((a,b)=>(a.order||999)-(b.order||999));const raw=localStorage.getItem(DRAFT_KEY);if(raw){const d=JSON.parse(raw);if(d.dictionary?.schema===bundle.schema&&Array.isArray(d.dictionary.tags)&&d.sourceFingerprint===state.sourceFingerprint){state.dictionary={...bundle,...d.dictionary};state.tags=d.dictionary.tags;state.promptOrder=d.dictionary.promptOrder;state.promptOrder.categories.sort((a,b)=>(a.order||999)-(b.order||999));$("#status").textContent="前回のローカル編集を復元しました。";}else{try{localStorage.setItem("ptd.admin.stale-draft.v1",raw);}catch(_){}$("#status").textContent="古いローカル編集は最新データと一致しないため復元しませんでした。旧データはこの端末に退避しています。";}}initResizer();const fillOptions=(id,values,blank=false)=>{const el=$("#"+id),opts=[...new Set(values.map(v=>String(v||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja")).map(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;return o;});el.replaceChildren();if(blank){const o=document.createElement("option");o.value="";o.textContent="（なし）";el.append(o);}el.append(...opts);const custom=document.createElement("option");custom.value="__new__";custom.textContent="＋ 新しい分類を入力…";el.append(custom);};fillOptions("major-select",state.tags.map(r=>r[2]));fillOptions("minor-select",state.tags.map(r=>r[3]));fillOptions("detail-select",state.tags.map(r=>r[4]),true);["major-select","minor-select","detail-select"].forEach(id=>$("#"+id).addEventListener("change",e=>{if(e.target.value!=="__new__")return;const value=prompt("追加する分類名を入力してください。");if(value&&value.trim()){const v=value.trim(),el=e.target;ensureCategoryOption(id,v);el.value=v;markDirty();}else{const previous=Array.from(e.target.options).find(o=>o.value!=="__new__");e.target.value=previous?previous.value:"";}}));$("#search").addEventListener("input",e=>{state.query=e.target.value;state.page=0;renderList();});$("#filter").addEventListener("change",e=>{state.filter=e.target.value;state.page=0;renderList();});$("#sort").addEventListener("change",e=>{state.sort=e.target.value;state.page=0;renderList();});$("#prev").addEventListener("click",()=>{state.page=Math.max(0,state.page-1);renderList();});$("#next").addEventListener("click",()=>{state.page++;renderList();});["tag","ja","aliases","reason","source","expression-level-reason"].forEach(id=>$("#"+id).addEventListener("input",markDirty));["major-select","minor-select","detail-select","translation-status","classification-status","expression-level"].forEach(id=>$("#"+id).addEventListener("change",markDirty));$("#save").addEventListener("click",save);$("#reset").addEventListener("click",()=>{if(state.selected)selectTag(state.selected);});$("#export-dictionary").addEventListener("click",exportDictionary);$("#prompt-order-reset").addEventListener("click",resetPromptOrder);$("#discard").addEventListener("click",()=>{if(!confirm("この端末に保存された管理画面の編集をすべて破棄しますか？出力済みファイルは削除されません。"))return;localStorage.removeItem(DRAFT_KEY);localStorage.removeItem("ptd.admin.stale-draft.v1");location.reload();});renderList();renderPromptOrder();}catch(e){$("#count").textContent="読み込み失敗";$("#results").textContent=e.message+"。GitHub Pages上またはローカルサーバーから開いてください。";}}
init();
})();