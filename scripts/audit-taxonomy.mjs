import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const taxonomy = await readJson("data/tag-taxonomy.json");
const outputOrder = await readJson("data/prompt-order-categories.json");
const errors = [];

if (taxonomy.schema !== "tag-taxonomy-v1") errors.push("Unknown taxonomy schema");
if (!Array.isArray(taxonomy.semanticCategories) || taxonomy.semanticCategories.length !== 9) errors.push("Expected exactly nine semantic categories");
const categories = [...(taxonomy.semanticCategories || [])].sort((a,b)=>a.order-b.order);
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
const targets = new Set((taxonomy.outputTargets || []).map(x=>x.id));
if (!targets.has("positive") || !targets.has("negative")) errors.push("positive/negative output targets are required");
if (!(taxonomy.virtualViews || []).some(x=>x.id==="negative-view" && x.source==="outputTarget" && x.target==="negative" && x.independentOfSemanticCategory===true)) errors.push("Negative virtual view must remain independent of semantic classification");
const promptCategories = [...(outputOrder.categories || [])].sort((a,b)=>a.order-b.order).map(x=>x.name);
const taxonomyNames = categories.map(x=>x.name);
if (promptCategories.length !== taxonomyNames.length || promptCategories.some((name,index)=>name!==taxonomyNames[index])) errors.push("Prompt output order must match the nine semantic category order");
for (const [kind,allowed] of Object.entries(taxonomy.reviewStatuses || {})) {
  if (!Array.isArray(allowed) || !allowed.includes("unreviewed") || !allowed.includes("needs-review") || !allowed.includes("verified")) errors.push("Invalid review statuses: "+kind);
}
if (errors.length) {
  for (const error of errors) console.error("ERROR: "+error);
  process.exitCode = 1;
} else {
  console.log("Taxonomy audit passed: nine semantic categories, output order, negative target, and review states are consistent.");
}
