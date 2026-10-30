import fs from "node:fs";
import assert from "node:assert/strict";
const tags = JSON.parse(fs.readFileSync("data/tags.json", "utf8"));
const groups = JSON.parse(fs.readFileSync("data/tag-groups.json", "utf8"));
const norm = value => String(value || "").normalize("NFKC").toLocaleLowerCase().trim();
const tagMap = new Map(tags.map(row => [norm(Array.isArray(row) ? row[0] : row.tag), row]));
const ids = new Set();
assert.ok(Array.isArray(groups), "tag-groups.json must be an array");
for (const group of groups) {
  assert.ok(group && typeof group.id === "string", "every group needs an id");
  assert.ok(!ids.has(group.id), `duplicate group id: ${group.id}`);
  ids.add(group.id);
  assert.ok(Array.isArray(group.members), `members must be an array: ${group.id}`);
  for (const member of group.members) assert.ok(tagMap.has(norm(member)), `unknown member tag: ${member} in ${group.id}`);
  if (group.type === "work") {
    assert.deepEqual(group.category, ["人物", "キャラクター"], `wrong virtual category: ${group.id}`);
    assert.ok(group.members.length > 0, `empty work group: ${group.id}`);
    if (group.titleTag) assert.ok(tagMap.has(norm(group.titleTag)), `unknown title tag: ${group.titleTag}`);
  }
}
const umamusume = groups.find(group => group.type === "work" && group.id === "work:umamusume");
assert.ok(umamusume, "Umamusume work group must exist");
assert.equal(norm(umamusume.titleTag), "umamusume", "Umamusume title tag must be independently selectable");
assert.ok(umamusume.members.some(tag => norm(tag) === "rice shower (umamusume)"), "Rice Shower must be in Umamusume");
assert.ok(umamusume.members.some(tag => norm(tag) === "gold ship (umamusume)"), "Gold Ship must be in Umamusume");
console.log(`Tag groups audit passed: ${groups.length} groups; ${new Set(groups.filter(group => group.type === "work").flatMap(group => group.members.map(norm))).size} work-character tags.`);
