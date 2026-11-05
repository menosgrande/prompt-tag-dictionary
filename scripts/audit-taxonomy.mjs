import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const taxonomy = data.taxonomy, outputOrder = data.promptOrder, errors = [];
if (taxonomy?.schema !== "tag-taxonomy-v1") errors.push("Unknown taxonomy schema");
if (!Array.isArray(taxonomy?.semanticCategories) || taxonomy.semanticCategories.length !== 18) errors.push("Expected exactly 18 semantic categories");
const categories = [...(taxonomy?.semanticCategories || [])].sort((a,b)=>a.order-b.order);
const categoryIds = new Set(), categoryNames = new Set(), subcategoryIds = new Set();
categories.forEach((category,index)=>{
  if (category.order !== index + 1) errors.push("Non-contiguous category order: "+category.name);
  if (categoryIds.has(category.id)) errors.push("Duplicate category id: "+category.id);
  if (categoryNames.has(category.name)) errors.push("Duplicate category name: "+category.name);
  categoryIds.add(category.id); categoryNames.add(category.name);
  if (!Array.isArray(category.subcategories) || !category.subcategories.length) errors.push("Missing subcategories: "+category.id);
  for (const sub of category.subcategories || []) {
    if (subcategoryIds.has(sub.id)) errors.push("Duplicate subcategory id: "+sub.id);
    subcategoryIds.add(sub.id);
  }
});
const targets = new Set((taxonomy?.outputTargets || []).map(x=>x.id));
if (!targets.has("positive") || !targets.has("negative")) errors.push("positive/negative output targets are required");
if (!(taxonomy?.virtualViews || []).some(x=>x.id==="negative-view" && x.source==="outputTarget" && x.target==="negative" && x.independentOfSemanticCategory===true && x.parentCategory==="quality")) errors.push("Negative virtual view must remain an output-target view nested under quality");
const promptCategories = [...(outputOrder?.categories || [])].sort((a,b)=>a.order-b.order).map(x=>x.name);
const taxonomyNames = categories.map(x=>x.name);
if (promptCategories.length !== taxonomyNames.length || promptCategories.some((name,index)=>name!==taxonomyNames[index])) errors.push("Prompt output order must match the semantic category order");
for (const category of categories) {
  const outputCategory = (outputOrder?.categories || []).find(item => item.name === category.name);
  const taxonomySubcategories = (category.subcategories || []).filter(item => !item.hidden).map(item => item.name);
  const outputSubcategories = outputCategory?.subcategories || [];
  if (taxonomySubcategories.length !== outputSubcategories.length || taxonomySubcategories.some((name,index)=>name!==outputSubcategories[index])) errors.push("Prompt subcategory order must match visible taxonomy: " + category.name);
}
for (const [kind,allowed] of Object.entries(taxonomy?.reviewStatuses || {})) {
  if (!Array.isArray(allowed) || !allowed.includes("unreviewed") || !allowed.includes("needs-review") || !allowed.includes("verified")) errors.push("Invalid review statuses: "+kind);
}
if (errors.length) { for (const error of errors) console.error("ERROR: "+error); process.exitCode=1; }
else console.log("Canonical taxonomy audit passed: 18 categories, output order, negative target, and review states are consistent.");
