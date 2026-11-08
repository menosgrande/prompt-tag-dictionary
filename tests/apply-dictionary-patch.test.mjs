import test from "node:test";
import assert from "node:assert/strict";
import { applyPatchData } from "../.github/scripts/apply-dictionary-patch.mjs";

function fixture() {
  return {
    tags: [
      ["sample tag", "サンプル", "大分類", "中分類"],
      ["metadata tag", "メタデータ", "大分類", "中分類", null, [], {
        translation: { status: "verified", evidence: "keep" },
        custom: { keep: true }
      }]
    ]
  };
}

test("applies supported fields while preserving unrelated metadata and row order", () => {
  const input = fixture();
  const result = applyPatchData(input, {
    schema: "prompt-tag-dictionary-patch-v1",
    operations: [
      { tag: "sample_tag", set: { ja: "変更後", major: "新分類" } },
      { tag: "metadata tag", set: { candidateJa: "候補訳" } }
    ]
  });
  assert.equal(result.updated, 2);
  assert.equal(result.data.tags[0][1], "変更後");
  assert.equal(result.data.tags[0][2], "新分類");
  assert.equal(result.data.tags[1][6].translation.evidence, "keep");
  assert.equal(result.data.tags[1][6].translation.candidateJa, "候補訳");
  assert.deepEqual(input, fixture(), "input object must not be mutated");
});

test("rejects unknown fields, malformed operations, and invalid values", () => {
  const data = fixture();
  const base = { schema: "prompt-tag-dictionary-patch-v1", operations: [] };
  assert.throws(() => applyPatchData(data, { ...base, extra: true }), /unsupported top-level/);
  assert.throws(() => applyPatchData(data, { ...base, operations: [{ tag: "sample tag", set: { nope: "x" } }] }), /Only ja/);
  assert.throws(() => applyPatchData(data, { ...base, operations: [{ tag: "sample tag", set: { ja: null } }] }), /must be a string/);
  assert.throws(() => applyPatchData(data, { ...base, operations: [null] }), /Invalid operation/);
  assert.throws(() => applyPatchData(data, { ...base, operations: [{ tag: "sample tag", set: {} }] }), /Only ja/);
});

test("rejects missing tags and duplicate operations after tag normalization", () => {
  const base = { schema: "prompt-tag-dictionary-patch-v1" };
  assert.throws(() => applyPatchData(fixture(), { ...base, operations: [{ tag: "missing", set: { ja: "x" } }] }), /Tag not found/);
  assert.throws(() => applyPatchData(fixture(), {
    ...base,
    operations: [
      { tag: "sample tag", set: { ja: "x" } },
      { tag: "sample_tag", set: { ja: "y" } }
    ]
  }), /Duplicate patch operation/);
});

test("rejects malformed cleanup configuration and empty no-op patches", () => {
  assert.throws(() => applyPatchData(fixture(), {
    schema: "prompt-tag-dictionary-patch-v1", operations: [], cleanup: { unexpected: true }
  }), /cleanup configuration/);
  assert.throws(() => applyPatchData(fixture(), {
    schema: "prompt-tag-dictionary-patch-v1", operations: []
  }), /no operations/);
});

test("packed review migration preserves existing metadata and removes legacy index", () => {
  const data = fixture();
  data.review = {
    entries: [[0, 0, "2026-11-08", 0, 0], null],
    translationStatusCodes: ["verified"],
    classificationStatusCodes: ["needs-review"],
    notes: ["根拠メモ"],
    sources: ["確認元"]
  };
  const result = applyPatchData(data, {
    schema: "prompt-tag-dictionary-patch-v1",
    operations: [],
    cleanup: { mergePackedReviewIntoTagMetadata: true }
  });
  assert.equal(result.packedReviewMerged, 1);
  assert.equal("review" in result.data, false);
  assert.equal(result.data.tags[0][6].translation.status, "verified");
  assert.equal(result.data.tags[0][6].classificationReview.status, "needs-review");
  assert.equal(result.data.tags[0][6].translation.reviewNote, "根拠メモ");
  assert.equal(result.data.tags[0][6].translation.source, "確認元");
});

test("invalid packed review index fails without mutating the input", () => {
  const data = fixture();
  data.review = {
    entries: [[99, 0, "2026-11-08", null, null], null],
    translationStatusCodes: ["verified"],
    classificationStatusCodes: ["needs-review"],
    notes: [],
    sources: []
  };
  assert.throws(() => applyPatchData(data, {
    schema: "prompt-tag-dictionary-patch-v1",
    operations: [],
    cleanup: { mergePackedReviewIntoTagMetadata: true }
  }), /Unknown packed review status/);
  assert.equal(data.tags[0].length, 4);
  assert.equal("review" in data, true);
});

test("archived classification cleanup rebuilds summary and preserves active entries", () => {
  const data = fixture();
  data.classificationCandidates = {
    entries: [{ status: "provisional" }, { status: "needs-review" }, { status: "verified" }],
    archivedEntries: [{ tag: "old" }]
  };
  const result = applyPatchData(data, {
    schema: "prompt-tag-dictionary-patch-v1",
    operations: [],
    cleanup: { removeArchivedClassificationCandidates: true }
  });
  assert.equal(result.removedArchivedClassificationCandidates, 1);
  assert.deepEqual(result.data.classificationCandidates.summary, {
    total: 3, provisional: 1, needsReview: 1, archived: 0
  });
  assert.equal("archivedEntries" in result.data.classificationCandidates, false);
});
