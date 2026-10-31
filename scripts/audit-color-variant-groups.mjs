import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [rows, data] = await Promise.all([
  readFile(resolve(root, "data/tags.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "data/color-variant-groups.json"), "utf8").then(JSON.parse)
]);
const errors = [];
const source = new Map(rows.map(row => [String(row[0]).toLowerCase(), row]));
const seen = new Set();
for (const group of data.groups || []) {
  if (!group.id || !Array.isArray(group.members) || !Array.isArray(group.options)) {
    errors.push("Invalid group structure: " + JSON.stringify(group.id));
    continue;
  }
  if (group.baseTag && !source.has(group.baseTag.toLowerCase())) errors.push("Missing base tag: " + group.baseTag);
  for (const member of group.members) {
    const key = String(member).toLowerCase();
    if (!source.has(key)) errors.push("Missing source tag: " + member);
    if (seen.has(key)) errors.push("Member appears in multiple groups: " + member);
    seen.add(key);
  }
  const distinctColors = new Set(group.options.map(option => option.color));
  if (distinctColors.size < 2) errors.push("Group has fewer than two colors: " + group.id);
  for (const option of group.options) {
    if (!source.has(String(option.tag).toLowerCase())) errors.push("Missing option tag: " + option.tag);
    if (!option.color || !String(option.tag).toLowerCase().startsWith(option.color + " ")) {
      errors.push("Color prefix mismatch: " + option.tag);
    }
  }
}
if (data.groupCount !== data.groups.length) errors.push("groupCount does not match groups.length");
console.log("Color variant group audit");
console.log("Groups: " + (data.groups || []).length);
console.log("Grouped tags: " + seen.size);
if (errors.length) {
  errors.slice(0,100).forEach(error => console.error("ERROR: " + error));
  process.exitCode = 1;
} else console.log("Audit passed: all group members map to existing source tags.");
