(() => {
"use strict";
const $ = selector => document.querySelector(selector);
const DRAFT_KEY = "ptd.admin.canonical-draft.v2";
const LAYOUT_KEY = "ptd.admin.layout.v1";
const PAGE_SIZE = 100;
const STATUS_LABEL = {
  unreviewed: "未確認",
  "needs-review": "要確認",
  verified: "確認済み",
  provisional: "暫定",
  "machine-translation": "機械翻訳",
  "not-applicable": "対象外"
};
const TRANSLATION_STATUSES = ["unreviewed", "needs-review", "verified", "machine-translation", "not-applicable"];
const CLASSIFICATION_STATUSES = ["unreviewed", "needs-review", "verified", "provisional", "not-applicable"];
const state = {
  bundle: null, tags: [], reviews: {}, log: null, promptOrder: null,
  selected: null, page: 0, query: "", filter: "all", sort: "source",
  dirty: false, sourceFingerprint: ""
};
let initialPromptOrder = null;
const norm = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().trim();
const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};
function fingerprintSource(bundle, log) {
  const source = JSON.stringify([bundle.tags, bundle.taxonomy, bundle.promptOrder, bundle.reviews, bundle.tagGroups, bundle.nsfwAudit, log]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return "ptd-v2-" + (hash >>> 0).toString(16);
}
function decodeReviews(packed) {
  if (!packed || packed.schemaVersion !== 1 || !packed.entries || typeof packed.entries !== "object") {
    throw new Error("正本内の確認状態データが不正です。");
  }
  const result = {};
  for (const [tag, values] of Object.entries(packed.entries)) {
    if (!Array.isArray(values) || values.length !== 5) throw new Error("確認状態の配列形式が不正です: " + tag);
    const [translationCode, classificationCode, reviewedAt, noteCode, sourceCode] = values;
    result[tag] = {
      translationStatus: packed.statusCodes?.translation?.[translationCode] || "unreviewed",
      classificationStatus: packed.statusCodes?.classification?.[classificationCode] || "unreviewed",
      reviewedAt: reviewedAt || null,
      note: noteCode ? packed.notes?.[noteCode - 1] || null : null,
      source: sourceCode ? packed.sources?.[sourceCode - 1] || null : null
    };
  }
  return result;
}
function encodeReviews(entries) {
  const notes = [], sources = [], noteIndex = new Map(), sourceIndex = new Map();
  const add = (value, list, index) => {
    if (!value) return 0;
    if (!index.has(value)) { index.set(value, list.length + 1); list.push(value); }
    return index.get(value);
  };
  const translationCodes = new Map(TRANSLATION_STATUSES.map((value, index) => [value, index]));
  const classificationCodes = new Map(CLASSIFICATION_STATUSES.map((value, index) => [value, index]));
  const packed = {};
  for (const [tag, entry] of Object.entries(entries)) {
    packed[tag] = [
      translationCodes.get(entry.translationStatus || "unreviewed") ?? 0,
      classificationCodes.get(entry.classificationStatus || "unreviewed") ?? 0,
      entry.reviewedAt || 0,
      add(entry.note, notes, noteIndex),
      add(entry.source, sources, sourceIndex)
    ];
  }
  return {
    schemaVersion: 1,
    statusCodes: { translation: TRANSLATION_STATUSES, classification: CLASSIFICATION_STATUSES },
    notes, sources, entries: packed
  };
}
function split(row) {
  return {
    tag: String(row[0] ?? ""), ja: String(row[1] ?? ""),
    major: String(row[2] ?? "未分類"), minor: String(row[3] ?? "未分類"),
    detail: String(row[4] ?? ""), aliases: Array.isArray(row[5]) ? row[5] : []
  };
}
function current() { return state.tags.find(tag => tag[0] === state.selected); }
function metadataFor(tag) {
  const row = state.tags.find(item => item[0] === tag), meta = row?.[6];
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
}
function entryFor(tag) {
  const meta = metadataFor(tag), stored = state.reviews[tag] || {};
  return {
    translationStatus: stored.translationStatus || meta.translation?.status || "unreviewed",
    classificationStatus: stored.classificationStatus || meta.classification?.status || meta.classificationReview?.status || "unreviewed",
    note: stored.note || meta.classification?.reason || meta.classificationReview?.reason || "",
    source: stored.source || meta.translation?.source || null,
    ...stored
  };
}
function statusFor(tag) {
  const entry = entryFor(tag);
  if (entry.translationStatus === "needs-review" || entry.classificationStatus === "needs-review") return "needs-review";
  if (entry.translationStatus === "verified" && entry.classificationStatus === "verified") return "verified";
  if (entry.classificationStatus === "provisional") return "provisional";
  return "unreviewed";
}
function matches() {
  const query = norm(state.query);
  const rows = state.tags.filter(row => {
    const tag = split(row);
    const text = norm([tag.tag, tag.ja, tag.major, tag.minor, tag.detail, ...tag.aliases].join(" "));
    return (!query || text.includes(query)) && (state.filter === "all" || statusFor(tag.tag) === state.filter);
  });
  if (state.sort === "category") {
    const compareCategory = (a, b) => {
      const au = !a || a === "未分類", bu = !b || b === "未分類";
      return au !== bu ? (au ? 1 : -1) : a.localeCompare(b, "ja");
    };
    rows.sort((a, b) => {
      const x = split(a), y = split(b);
      return compareCategory(x.major, y.major) || compareCategory(x.minor, y.minor) || x.tag.localeCompare(y.tag, "en");
    });
  } else if (state.sort === "tag") rows.sort((a, b) => split(a).tag.localeCompare(split(b).tag, "en"));
  return rows;
}
function initResizer() {
  const layout = $(".layout"), list = $("#results"), resizer = $("#list-resizer"), card = $(".tag-list-card");
  if (!layout || !list || !resizer || !card) return;
  const mobile = () => window.matchMedia("(max-width: 850px)").matches;
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
    if (Number.isFinite(saved.width) && saved.width >= 240) layout.style.setProperty("--list-pane-width", saved.width + "px");
    if (Number.isFinite(saved.height) && saved.height >= 180) layout.style.setProperty("--list-pane-height", saved.height + "px");
  } catch {}
  const save = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
      if (!mobile()) saved.width = Math.round(card.getBoundingClientRect().width + 8);
      saved.height = Math.round(list.getBoundingClientRect().height);
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(saved));
    } catch {}
  };
  let dragging = false;
  resizer.addEventListener("pointerdown", event => {
    if (mobile()) return;
    dragging = true; resizer.classList.add("dragging");
    resizer.setPointerCapture(event.pointerId); event.preventDefault();
  });
  resizer.addEventListener("pointermove", event => {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect(), max = Math.max(240, rect.width - 340);
    layout.style.setProperty("--list-pane-width", Math.max(240, Math.min(max, event.clientX - rect.left)) + "px");
  });
  const stop = () => { if (!dragging) return; dragging = false; resizer.classList.remove("dragging"); save(); };
  resizer.addEventListener("pointerup", stop);
  resizer.addEventListener("pointercancel", stop);
  resizer.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const width = card.getBoundingClientRect().width, max = Math.max(240, layout.clientWidth - 340);
    layout.style.setProperty("--list-pane-width", Math.max(240, Math.min(max, width + (event.key === "ArrowRight" ? 20 : -20))) + "px");
    save();
  });
  if ("ResizeObserver" in window) new ResizeObserver(save).observe(list);
}
function renderPromptOrder() {
  const root = $("#prompt-order-list");
  if (!root) return;
  root.replaceChildren();
  state.promptOrder.categories.forEach((category, index) => {
    const li = document.createElement("li"), label = document.createElement("div");
    const name = document.createElement("strong"), purpose = document.createElement("small");
    const controls = document.createElement("div"), up = document.createElement("button"), down = document.createElement("button");
    li.className = "prompt-order-item";
    name.textContent = category.name; purpose.textContent = category.purpose || "";
    label.className = "prompt-order-label"; label.append(name, purpose);
    controls.className = "prompt-order-controls";
    up.type = down.type = "button"; up.textContent = "↑"; down.textContent = "↓";
    up.title = "上へ"; down.title = "下へ"; up.disabled = index === 0; down.disabled = index === state.promptOrder.categories.length - 1;
    up.addEventListener("click", () => movePromptCategory(index, -1));
    down.addEventListener("click", () => movePromptCategory(index, 1));
    controls.append(up, down); li.append(label, controls); root.append(li);
  });
  $("#prompt-order-count").textContent = state.promptOrder.categories.length + "カテゴリ";
}
function movePromptCategory(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= state.promptOrder.categories.length) return;
  const rows = state.promptOrder.categories;
  [rows[index], rows[next]] = [rows[next], rows[index]];
  rows.forEach((row, i) => { row.order = i + 1; });
  state.bundle.promptOrder = state.promptOrder;
  persist(); renderPromptOrder();
  $("#prompt-order-status").textContent = "並び順をこの端末に保存しました。一括エクスポートで正本へ反映できます。";
}
function resetPromptOrder() {
  if (!initialPromptOrder) return;
  state.promptOrder = JSON.parse(JSON.stringify(initialPromptOrder));
  state.bundle.promptOrder = state.promptOrder;
  persist(); renderPromptOrder();
  $("#prompt-order-status").textContent = "読み込み時のカテゴリ順に戻しました。";
}
function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}
function exportAdminBundle() {
  if (state.dirty) { $("#export-status").textContent = "未保存の入力があります。先に「変更を保存」を押してください。"; return; }
  state.bundle.reviews = encodeReviews(state.reviews);
  state.bundle.promptOrder = { ...state.promptOrder, categories: state.promptOrder.categories.map((item, index) => ({ ...item, order: index + 1 })) };
  const output = {
    schema: "prompt-tag-admin-export-v2", schemaVersion: 2,
    exportedAt: new Date().toISOString(), sourceFingerprint: state.sourceFingerprint,
    dictionary: state.bundle, changeLog: state.log
  };
  download("dictionary-data-update.json", output);
  $("#export-status").textContent = "正本と変更履歴を含む更新ファイルを出力しました。リポジトリで node scripts/apply-admin-export.mjs --input dictionary-data-update.json --check を実行して検証し、問題がなければ --write で反映します。";
}
function renderList() {
  const all = matches(), pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const start = state.page * PAGE_SIZE, root = $("#results");
  root.replaceChildren();
  all.slice(start, start + PAGE_SIZE).forEach(row => {
    const tag = split(row), button = document.createElement("button");
    button.type = "button"; button.className = "tag-item" + (state.selected === tag.tag ? " active" : "");
    const strong = document.createElement("strong"), small = document.createElement("small"), badge = document.createElement("em");
    strong.textContent = tag.tag;
    small.textContent = (tag.ja || "（訳なし）") + " · " + tag.major + " › " + tag.minor;
    badge.textContent = STATUS_LABEL[statusFor(tag.tag)] || "未確認";
    button.append(strong, small, badge); button.addEventListener("click", () => selectTag(tag.tag)); root.append(button);
  });
  $("#count").textContent = all.length.toLocaleString("ja-JP") + "件";
  $("#page").textContent = all.length ? (start + 1) + "–" + Math.min(start + PAGE_SIZE, all.length) + " / " + all.length + "（" + (state.page + 1) + "/" + pages + "）" : "0件";
  $("#prev").disabled = state.page === 0; $("#next").disabled = state.page >= pages - 1;
}
function readForm() {
  return {
    tag: $("#tag").value.trim(), ja: $("#ja").value,
    major: $("#major-select").value, minor: $("#minor-select").value,
    detail: $("#detail-select").value.trim(),
    aliases: [...new Set($("#aliases").value.split(",").map(value => value.trim()).filter(Boolean))],
    translationStatus: $("#translation-status").value,
    classificationStatus: $("#classification-status").value,
    reason: $("#reason").value.trim(), source: $("#source").value.trim() || null
  };
}
function baseline() {
  const row = current();
  if (!row) return null;
  const entry = entryFor(state.selected), tag = split(row);
  return {
    ...tag, translationStatus: entry.translationStatus, classificationStatus: entry.classificationStatus,
    reason: entry.note || "", source: entry.source || null
  };
}
function renderDiff() {
  const before = baseline(), after = readForm();
  if (!before) { $("#diff").textContent = "タグを選択してください。"; return; }
  const labels = [["tag", "英語タグ名"], ["ja", "日本語訳"], ["major", "大分類"], ["minor", "小分類"], ["detail", "詳細分類"], ["aliases", "別名"], ["translationStatus", "翻訳状態"], ["classificationStatus", "分類状態"], ["reason", "修正理由"], ["source", "出典"]];
  const changes = labels.filter(([key]) => JSON.stringify(before[key] ?? "") !== JSON.stringify(after[key] ?? ""));
  $("#diff").textContent = changes.length
    ? changes.map(([key, label]) => label + "\n  変更前: " + (before[key] || "（空）") + "\n  変更後: " + (after[key] || "（空）")).join("\n\n")
    : "変更はありません。";
}
function ensureOption(id, value) {
  const element = $("#" + id);
  if (value && !Array.from(element.options).some(option => option.value === value)) {
    const option = document.createElement("option"); option.value = value;
    option.textContent = value + "（既存データ）"; element.append(option);
  }
}
function selectTag(tag) {
  if (state.dirty && !confirm("未保存の入力があります。破棄して別のタグを開きますか？")) return;
  state.selected = tag; state.dirty = false;
  const row = current(), entry = entryFor(tag), value = split(row);
  $("#selected-name").textContent = tag; $("#tag").value = value.tag; $("#ja").value = value.ja;
  ensureOption("major-select", value.major); ensureOption("minor-select", value.minor); ensureOption("detail-select", value.detail);
  $("#major-select").value = value.major; $("#minor-select").value = value.minor; $("#detail-select").value = value.detail;
  $("#aliases").value = value.aliases.join(", ");
  $("#translation-status").value = entry.translationStatus; $("#classification-status").value = entry.classificationStatus;
  $("#reason").value = entry.note || ""; $("#source").value = entry.source || "";
  $("#save").disabled = false; $("#reset").disabled = false;
  $("#status").textContent = ""; renderDiff(); renderList();
}
function markDirty() { state.dirty = true; renderDiff(); }
function save() {
  const row = current();
  if (!row) return;
  const before = baseline(), form = readForm();
  if (!form.tag) { $("#status").textContent = "英語タグ名を入力してください。"; return; }
  if (state.tags.some((item, index) => index !== state.tags.indexOf(row) && norm(item[0]) === norm(form.tag))) {
    $("#status").textContent = "同じ英語タグ名が既にあります。"; return;
  }
  const category = state.bundle.taxonomy.semanticCategories.find(item => item.name === form.major);
  if (!category || !category.subcategories.some(item => item.name === form.minor)) {
    $("#status").textContent = "分類体系に存在しない大分類・小分類は保存できません。"; return;
  }
  const oldKey = state.selected;
  const fields = [], beforeData = {}, afterData = {};
  for (const key of ["tag", "ja", "major", "minor", "detail", "aliases", "translationStatus", "classificationStatus", "reason", "source"]) {
    if (JSON.stringify(before[key] ?? "") !== JSON.stringify(form[key] ?? "")) {
      fields.push(key); beforeData[key] = before[key] ?? null; afterData[key] = form[key] ?? null;
    }
  }
  if (!fields.length) { state.dirty = false; $("#status").textContent = "変更はありません。"; return; }
  if (row.length === 4) { row[4] = ""; row[5] = []; row[6] = {}; }
  else if (row.length === 6) row[6] = {};
  row[0] = form.tag; row[1] = form.ja; row[2] = form.major; row[3] = form.minor; row[4] = form.detail; row[5] = form.aliases;
  const prior = state.reviews[oldKey] || {};
  const nextEntry = {
    translationStatus: form.translationStatus, classificationStatus: form.classificationStatus,
    reviewedAt: (form.translationStatus === "verified" || form.classificationStatus === "verified") ? today() : (prior.reviewedAt || null),
    note: form.reason || null, source: form.source
  };
  delete state.reviews[oldKey];
  state.reviews[form.tag] = nextEntry;
  state.log.changes.push({
    tag: form.tag, ...(oldKey !== form.tag ? { previousTag: oldKey } : {}),
    changedAt: today(), fields, before: beforeData, after: afterData,
    reason: form.reason || "管理画面から修正", source: form.source
  });
  state.selected = form.tag; state.dirty = false;
  state.bundle.reviews = encodeReviews(state.reviews);
  persist(); $("#selected-name").textContent = form.tag; renderList(); renderDiff();
  $("#status").textContent = "この端末に保存しました。一括エクスポートするまで公開データは変更されません。";
}
function persist() {
  try {
    state.bundle.reviews = encodeReviews(state.reviews);
    state.bundle.promptOrder = state.promptOrder;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      sourceFingerprint: state.sourceFingerprint, dictionary: state.bundle,
      changeLog: state.log, selected: state.selected
    }));
  } catch {
    $("#status").textContent = "ローカル保存に失敗しました。ブラウザの保存容量を確認してください。";
  }
}
function fillOptions(id, values) {
  const element = $("#" + id);
  const options = [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja")).map(value => {
      const option = document.createElement("option"); option.value = value; option.textContent = value; return option;
    });
  element.replaceChildren(...options);
}
async function init() {
  try {
    const [bundleResponse, logResponse] = await Promise.all([
      fetch("./data/dictionary-data.json"), fetch("./data/tag-change-log.json")
    ]);
    if (!bundleResponse.ok || !logResponse.ok) throw new Error("正本または変更履歴を読み込めません。");
    const bundle = await bundleResponse.json(), log = await logResponse.json();
    if (bundle.schema !== "prompt-tag-dictionary-runtime-v1" || !Array.isArray(bundle.tags) ||
        !bundle.taxonomy?.semanticCategories || !bundle.promptOrder?.categories || !Array.isArray(bundle.tagGroups) ||
        !Array.isArray(bundle.nsfwAudit?.candidates)) throw new Error("正本の形式が不正です。");
    if (log.schemaVersion !== 1 || !Array.isArray(log.changes)) throw new Error("変更履歴の形式が不正です。");
    state.bundle = bundle; state.tags = bundle.tags; state.reviews = decodeReviews(bundle.reviews);
    state.log = log; state.promptOrder = bundle.promptOrder;
    initialPromptOrder = JSON.parse(JSON.stringify(bundle.promptOrder));
    state.sourceFingerprint = fingerprintSource(bundle, log);
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft.sourceFingerprint === state.sourceFingerprint && draft.dictionary?.schema === bundle.schema) {
        state.bundle = draft.dictionary; state.tags = state.bundle.tags;
        state.reviews = decodeReviews(state.bundle.reviews); state.log = draft.changeLog || log;
        state.promptOrder = state.bundle.promptOrder; state.selected = draft.selected || null;
        $("#status").textContent = "前回のローカル編集を復元しました。";
      } else {
        try { localStorage.setItem("ptd.admin.stale-draft.v2", raw); } catch {}
        $("#status").textContent = "古いローカル編集は最新正本と一致しないため復元しませんでした。端末内に退避しています。";
      }
    }
    initResizer();
    const taxonomy = bundle.taxonomy.semanticCategories;
    fillOptions("major-select", taxonomy.map(item => item.name));
    fillOptions("minor-select", taxonomy.flatMap(item => item.subcategories.map(sub => sub.name)));
    fillOptions("detail-select", state.tags.map(row => row[4]).filter(Boolean));
    ["tag", "ja", "aliases", "reason", "source"].forEach(id => $("#" + id).addEventListener("input", markDirty));
    ["major-select", "minor-select", "detail-select", "translation-status", "classification-status"].forEach(id => $("#" + id).addEventListener("change", markDirty));
    $("#search").addEventListener("input", event => { state.query = event.target.value; state.page = 0; renderList(); });
    $("#filter").addEventListener("change", event => { state.filter = event.target.value; state.page = 0; renderList(); });
    $("#sort").addEventListener("change", event => { state.sort = event.target.value; state.page = 0; renderList(); });
    $("#prev").addEventListener("click", () => { state.page = Math.max(0, state.page - 1); renderList(); });
    $("#next").addEventListener("click", () => { state.page++; renderList(); });
    $("#save").addEventListener("click", save);
    $("#reset").addEventListener("click", () => { if (state.selected) selectTag(state.selected); });
    $("#export-admin-bundle").addEventListener("click", exportAdminBundle);
    $("#prompt-order-reset").addEventListener("click", resetPromptOrder);
    $("#discard").addEventListener("click", () => {
      if (!confirm("この端末に保存された管理画面の編集を破棄しますか？")) return;
      localStorage.removeItem(DRAFT_KEY); location.reload();
    });
    renderList(); renderPromptOrder();
    if (state.selected) selectTag(state.selected);
  } catch (error) {
    $("#count").textContent = "読み込み失敗";
    $("#results").textContent = error.message + "。GitHub Pages上またはローカルサーバーから開いてください。";
  }
}
init();
})();