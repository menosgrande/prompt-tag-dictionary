// Audit color-prefixed tags and hair-color overlaps. Audit only; never mutates tags.json.
import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync('data/tags.json','utf8'));
const colors=["black","white","red","blue","light blue","dark blue","green","yellow","orange","pink","purple","violet","brown","grey","gray","silver","gold","blonde","blond","aqua","cyan","navy","teal","maroon","beige","ivory","cream"];
const jaColors=["黒","白","赤","紅","青","水色","紺","緑","黄","橙","オレンジ","ピンク","桃","紫","茶","灰","グレー","銀","金","金色","銀色","ネイビー","ベージュ"];
const esc=s=>s.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&');
const enRe=new RegExp('^('+colors.slice().sort((a,b)=>b.length-a.length).map(esc).join('|')+')[ -]+(.+)$','i');
const jaRe=new RegExp('^('+jaColors.slice().sort((a,b)=>b.length-a.length).map(esc).join('|')+')(?:色|色の|の)?(.+)$');
const items=rows.map((r,index)=>({index,tag:r[0],ja:r[1],major:r[2],minor:r[3]}));
const en=items.filter(x=>enRe.test(x.tag)); const ja=items.filter(x=>jaRe.test(x.ja));
const map=new Map([...en,...ja].map(x=>[x.index,x])); const all=[...map.values()].sort((a,b)=>a.index-b.index);
const hair=items.filter(x=>/(?:^| )(?:hair|hair color)$/.test(x.tag)||/髪/.test(x.ja));
const hairColor=hair.filter(x=>enRe.test(x.tag)||jaRe.test(x.ja)); const groups=new Map();
for(const x of hairColor){if(!groups.has(x.ja))groups.set(x.ja,[]);groups.get(x.ja).push(x.tag);}
const overlaps=[...groups].filter(([,v])=>v.length>1).map(([ja,tags])=>({ja,tags}));
const protectedRows=all.filter(x=>/[()（）]|作品・キャラクター|キャラクター|シリーズ|固有名詞/.test(x.tag+' '+x.major+' '+x.minor));
const needsReview=all.filter(x=>!protectedRows.includes(x)&&(!enRe.test(x.tag)||/^(aqua|blonde|blond|silver|gold|grey|gray|light blue|dark blue|navy|teal|ivory|cream) /.test(x.tag)));
const likely=all.filter(x=>!protectedRows.includes(x)&&enRe.test(x.tag)&&!needsReview.includes(x));
const report={schema:'color-prefix-audit-v1',source:'data/tags.json',total_tags:rows.length,summary:{english_color_prefix_candidates:en.length,japanese_color_prefix_candidates:ja.length,unique_candidates:all.length,likely_separable:likely.length,needs_review:needsReview.length,protected_or_named:protectedRows.length,hair_color_tags:hairColor.length,hair_translation_overlap_groups:overlaps.length},policy:'Audit only. No tags are removed, renamed, merged, or reclassified.',hair_translation_overlaps:overlaps,hair_color_tags:hairColor,likely_separable:likely,needs_review:needsReview,protected_or_named:protectedRows};
fs.writeFileSync('data/color-prefix-audit.json',JSON.stringify(report,null,2)+'\\n');
console.log(report.summary);
