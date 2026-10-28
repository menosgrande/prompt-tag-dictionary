(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const STORAGE_KEY = "ptd.dictionary.v1";
  const SELECTED_KEY = "ptd.selected.v1";
  const DEFAULT_PAGE_SIZE = 100;
  function pageSize(total) {
    const value = $("#page-size")?.value || String(DEFAULT_PAGE_SIZE);
    return value === "all" ? Math.max(1, total) : Math.max(1, Number(value) || DEFAULT_PAGE_SIZE);
  }
  const CATEGORIES = [
    ["人物","People","人数","性別・体形","年齢","頭髪","顔・表情","目","胸","身体・部位","種族・役割"],
    ["服装","Clothing","衣類","靴","小物","下着・水着","装備"],
    ["ポーズ・動作","Pose & Action","姿勢","行動","手の動き","対人動作"],
    ["構図・視点","Composition & Camera","構図","撮影範囲","カメラ角度","視点"],
    ["シチュエーション","Situation","関係性","日常","イベント","成人向け状況"],
    ["背景・場所","Background & Location","屋内","施設","自然","都市","時間・天候"],
    ["画風・品質","Style & Quality","画風","品質","描写技法","媒体"],
    ["光・色彩","Light & Color","照明","色","色調"],
    ["その他","Other","動物","物","自然物","記号・効果"],
    ["成人向け","Adult","身体・衣類","行為・状況","表現・修正"],
    ["未分類","Uncategorized","未分類"]
  ];
  const enMajor = Object.fromEntries(CATEGORIES.map(c => [c[0], c[1]]));
  const defaultMinor = Object.fromEntries(CATEGORIES.map(c => [c[0], c.slice(2)]));
  const state = { tags: [], selected: new Set(), category: null, page: 0, query: "", outputExcluded: new Set(), columnSort: null };

  function norm(s) {
    return String(s ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
  }
  function splitCategory(raw) {
    if (Array.isArray(raw)) return raw.length > 1 ? [String(raw[0]), String(raw[1])] : [String(raw[0] || "未分類"), "未分類"];
    if (typeof raw === "string" && raw) {
      const parts = raw.split(/[/>／|]/).map(s => s.trim()).filter(Boolean);
      return parts.length > 1 ? parts.slice(0, 2) : [parts[0] || "未分類", "未分類"];
    }
    return ["未分類", "未分類"];
  }
  function normalizeCategory(tag, category) {
    let [major, minor] = category;
    const t = norm(tag);
    const has = (re) => re.test(t);
    const personMinor = () => {
      if (has(/\b(breast|breasts|boob|boobs|chest|cleavage|bust|flat chest|large breasts|small breasts)\b/)) return "胸";
      if (has(/\b(eye|eyes|eyebrow|eyelash|pupil|iris|heterochromia)\b/)) return "目";
      if (has(/\b(hair|haired|hairstyle|bangs|braid|ponytail|bun|ahoge|twintail|twintails|bob cut|bald|shaved head|long hair|short hair)\b/)) return "頭髪";
      if (has(/\b(smile|grin|frown|blush|blushing|expression|angry|annoyed|crying|tears|wink|grimace|smirk|open mouth|closed mouth|mouth|lips|nose|freckles|facial mark)\b/)) return "顔・表情";
      if (has(/\b(girl|boy|woman|man|female|male|feminine|masculine|androgynous|muscular|slim|thick|curvy|petite|tall|short stature|body type)\b/)) return "性別・体形";
      if (has(/\b(baby|child|kid|teen|teenager|young|old woman|old man|elderly)\b/)) return "年齢";
      if (has(/\b(angel|demon|devil|alien|android|robot|elf|vampire|witch|fairy|mermaid|kemonomimi|animal ears|horns|wings)\b/)) return "種族・役割";
      return "身体・部位";
    };
    if (major === "髪・目・体") {
      major = "人物";
      if (/髪型|髪色|目の色/.test(minor)) minor = minor === "目の色" ? "目" : "頭髪";
      else if (minor === "顔の特徴") minor = personMinor();
      else if (minor === "身体の特徴") minor = personMinor();
      else minor = personMinor();
    } else if (major === "顔・表情") {
      major = "人物";
      if (minor === "表情") minor = "顔・表情";
      else if (minor === "目") minor = "目";
      else minor = personMinor();
    } else if (major === "人物") {
      if (/属性|年齢/.test(minor)) minor = personMinor();
      if (minor === "属性") minor = personMinor();
      if (minor === "種族・役割") minor = "種族・役割";
    } else if (major === "成人向け" && has(/\b(breast|breasts|boob|boobs|chest|cleavage|bust)\b/)) {
      major = "人物"; minor = "胸";
    }
    return [major || "未分類", minor || "未分類"];
  }
  function cleanTag(obj) {
    let item;
    if (typeof obj === "string") item = { tag: obj };
    else if (Array.isArray(obj)) item = { tag: obj[0], ja: obj[1] || "", category: obj.length >= 4 ? [obj[2], obj[3]] : undefined };
    else item = obj || {};
    const tag = String(item.tag ?? item.t ?? item.english ?? item.name ?? "").trim();
    if (!tag) return null;
    const category = normalizeCategory(tag, splitCategory(item.category ?? item.categories ?? item.cat));
    const aliases = [...new Set([
      ...(Array.isArray(item.aliases) ? item.aliases : []),
      ...(Array.isArray(item.keywords) ? item.keywords : []),
      ...(Array.isArray(item.search) ? item.search : [])
    ].map(String).filter(Boolean))];
    return {
      tag, ja: String(item.ja ?? item.japanese ?? item.gloss ?? item.j ?? ""),
      category, aliases, explanation: String(item.explanation ?? item.description ?? ""),
      related: Array.isArray(item.related) ? item.related : [],
      preview: String(item.preview ?? item.image ?? ""), source: String(item.source ?? "import")
    };
  }
  function mergeTags(base, incoming, replace = false) {
    const map = new Map();
    if (!replace) base.forEach(t => map.set(norm(t.tag), t));
    incoming.forEach(raw => {
      const t = cleanTag(raw);
      if (!t) return;
      const key = norm(t.tag), prev = map.get(key);
      if (prev) {
        map.set(key, {
          ...prev, ...t, ja: t.ja || prev.ja,
          category: t.category[0] === "未分類" ? prev.category : t.category,
          aliases: [...new Set([...(prev.aliases || []), ...(t.aliases || [])])],
          explanation: t.explanation || prev.explanation,
          related: t.related.length ? t.related : (prev.related || []),
          preview: t.preview || prev.preview
        });
      } else map.set(key, t);
    });
    return [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag, "en", { sensitivity: "base" }));
  }
  function seedTags() {
    return fetch("./data/tags.json").then(r => {
      if (!r.ok) throw new Error("seed data missing");
      return r.json();
    });
  }
  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tags)); }
    catch (e) { setStatus("import-status", "ブラウザの保存容量を超えたため、今回のデータは保存できませんでした。", true); }
  }
  function saveSelected() { try { localStorage.setItem(SELECTED_KEY, JSON.stringify([...state.selected])); } catch {} }
  function majorOf(t) { return (t.category && t.category[0]) || "未分類"; }
  function minorOf(t) { return (t.category && t.category[1]) || "未分類"; }
  function categoryText(t) {
    const a = majorOf(t), b = minorOf(t);
    return a === "未分類" ? "未分類" : a + " › " + b;
  }
  function setStatus(id, msg, error = false) {
    const el = $("#" + id);
    if (el) { el.textContent = msg; el.style.color = error ? "var(--danger)" : "var(--accent)"; }
  }
  function normalizeRecords() { state.tags = mergeTags([], state.tags, true); }

  function renderStats() {
    $("#stat-total").textContent = state.tags.length.toLocaleString("ja-JP");
    $("#stat-selected").textContent = state.selected.size.toLocaleString("ja-JP");
  }
  function categoryCounts() {
    const counts = new Map();
    state.tags.forEach(t => {
      const major = majorOf(t), minor = minorOf(t);
      if (!counts.has(major)) counts.set(major, { total: 0, minors: new Map() });
      const entry = counts.get(major);
      entry.total++;
      entry.minors.set(minor, (entry.minors.get(minor) || 0) + 1);
    });
    return counts;
  }
  function renderCategories() {
    const root = $("#category-tree"); root.replaceChildren();
    const counts = categoryCounts();
    const majors = [...new Set([...CATEGORIES.map(c => c[0]), ...counts.keys()])];
    majors.sort((a, b) => {
      if (a === "未分類") return 1;
      if (b === "未分類") return -1;
      const ia = CATEGORIES.findIndex(c => c[0] === a);
      const ib = CATEGORIES.findIndex(c => c[0] === b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, "ja");
    });
    majors.forEach(major => {
      const entry = counts.get(major) || { total: 0, minors: new Map() };
      const wrap = document.createElement("div"); wrap.className = "category-major";
      const btn = document.createElement("button");
      btn.className = "category-major-button" + (state.category?.[0] === major && !state.category?.[1] ? " active" : "");
      btn.type = "button";
      const label = document.createElement("span"); label.textContent = major;
      const count = document.createElement("span"); count.className = "count"; count.textContent = entry.total.toLocaleString("ja-JP");
      btn.append(label, count);
      btn.addEventListener("click", () => {
        state.category = state.category?.[0] === major && !state.category?.[1] ? null : [major, null];
        state.page = 0; renderAll();
      });
      wrap.append(btn);
      const knownMinors = defaultMinor[major] || [];
      const minors = major === "人物"
        ? [...new Set([...knownMinors, ...entry.minors.keys()])]
        : [...new Set([...knownMinors, ...entry.minors.keys()])].filter(m => entry.minors.has(m));
      const minWrap = document.createElement("div"); minWrap.className = "category-minors";
      minors.forEach(minor => {
        const n = entry.minors.get(minor) || 0;
        const mb = document.createElement("button"); mb.type = "button";
        mb.className = "category-minor" + (state.category?.[0] === major && state.category?.[1] === minor ? " active" : "");
        const ml = document.createElement("span"); ml.textContent = minor;
        const mc = document.createElement("span"); mc.className = "count"; mc.textContent = n.toLocaleString("ja-JP");
        mb.append(ml, mc);
        mb.addEventListener("click", () => {
          state.category = state.category?.[0] === major && state.category?.[1] === minor ? null : [major, minor];
          state.page = 0; renderAll();
        });
        minWrap.append(mb);
      });
      if (minors.length) wrap.append(minWrap);
      root.append(wrap);
    });
  }
  function matchingTags() {
    const q = norm(state.query), level = $("#level-filter").value;
    let list = state.tags.filter(t => {
      if (state.category && (majorOf(t) !== state.category[0] || (state.category[1] && minorOf(t) !== state.category[1]))) return false;
      if (level === "known" && majorOf(t) === "未分類") return false;
      if (level === "unknown" && majorOf(t) !== "未分類") return false;
      if (!q) return true;
      const hay = [t.tag, t.ja, ...(t.aliases || []), ...(t.related || [])].join(" ");
      return norm(hay).includes(q);
    });
    const sort = $("#sort-order").value;
    const englishCompare = (a, b) => a.tag.localeCompare(b.tag, "en", { sensitivity: "base" });
    if (sort === "english") list.sort(englishCompare);
    else if (sort === "japanese") list.sort((a, b) => {
      const jaA = a.ja || "\uffff", jaB = b.ja || "\uffff";
      return jaA.localeCompare(jaB, "ja") || englishCompare(a, b);
    });
    else if (sort === "selected") list.sort((a, b) => Number(state.selected.has(norm(b.tag))) - Number(state.selected.has(norm(a.tag))) || englishCompare(a, b));
    else if (sort === "uncategorized") list.sort((a, b) => Number(majorOf(b) === "未分類") - Number(majorOf(a) === "未分類") || englishCompare(a, b));
    else if (q) list.sort((a, b) => {
      const score = t => {
        const tag = norm(t.tag), ja = norm(t.ja);
        if (tag === q || ja === q) return 0;
        if (tag.startsWith(q) || ja.startsWith(q)) return 1;
        return 2;
      };
      return score(a) - score(b) || englishCompare(a, b);
    });
    else list.sort(englishCompare);
    if (state.columnSort) {
      const { key, dir } = state.columnSort;
      const compareText = (a, b, getter, locale = "ja") => getter(a).localeCompare(getter(b), locale, { sensitivity: "base" }) || englishCompare(a, b);
      const compare = key === "tag"
        ? (a, b) => englishCompare(a, b)
        : key === "japanese"
          ? (a, b) => (a.ja || "\uffff").localeCompare(b.ja || "\uffff", "ja") || englishCompare(a, b)
          : key === "element1"
            ? (a, b) => compareText(a, b, t => majorOf(t))
            : key === "element2"
              ? (a, b) => compareText(a, b, t => minorOf(t))
              : key === "category"
                ? (a, b) => compareText(a, b, t => majorOf(t) + " " + minorOf(t))
                : key === "selected"
              ? (a, b) => Number(state.selected.has(norm(b.tag))) - Number(state.selected.has(norm(a.tag))) || englishCompare(a, b)
              : englishCompare;
      list.sort((a, b) => dir * compare(a, b));
    }
    return list;
  }
  function makeButton(text, cls, action) {
    const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = text;
    b.addEventListener("click", action); return b;
  }
  function renderResults() {
    const all = matchingTags(), size = pageSize(all.length), start = state.page * size, items = all.slice(start, start + size), root = $("#tag-results");
    root.replaceChildren();
    document.querySelectorAll("[data-column-sort]").forEach(button => {
      const key = button.dataset.columnSort;
      const label = button.dataset.label;
      button.textContent = label + (state.columnSort?.key === key ? (state.columnSort.dir === 1 ? " ↑" : " ↓") : " ↕");
      button.setAttribute("aria-sort", state.columnSort?.key === key ? (state.columnSort.dir === 1 ? "ascending" : "descending") : "none");
    });
    $("#results-title").textContent = state.query ? "検索結果" : state.category ? categoryText({ category: state.category }) : "タグ一覧";
    $("#result-count").textContent = all.length.toLocaleString("ja-JP") + "件";
    $("#empty-state").hidden = all.length !== 0; root.hidden = all.length === 0;
    items.forEach(t => {
      const row = document.createElement("div"); row.className = "tag-row";
      const check = document.createElement("input");
      check.type = "checkbox"; check.className = "tag-check";
      check.checked = state.selected.has(norm(t.tag));
      check.setAttribute("aria-label", (check.checked ? "選択解除 " : "選択 ") + t.tag);
      check.addEventListener("change", () => toggleSelected(t));
      const english = document.createElement("span"); english.className = "tag-english"; english.textContent = t.tag;
      const japanese = document.createElement("span"); japanese.className = "tag-japanese"; japanese.textContent = t.ja || "—";
      const element1 = document.createElement("span"); element1.className = "tag-category tag-element1";
      element1.textContent = majorOf(t);
      element1.title = majorOf(t);
      const element2 = document.createElement("span"); element2.className = "tag-category tag-element2";
      element2.textContent = minorOf(t);
      element2.title = minorOf(t);
      row.append(check, english, japanese, element1, element2); row.title = t.explanation || t.tag;
      root.append(row);
    });
    const pages = Math.max(1, Math.ceil(all.length / size));
    $("#page-summary").textContent = all.length ? (start + 1) + "–" + Math.min(start + size, all.length) + " / " + all.length.toLocaleString("ja-JP") : "0件";
    $("#prev-page").disabled = state.page <= 0; $("#next-page").disabled = state.page >= pages - 1;
  }
  function toggleSelected(t) {
    const key = norm(t.tag);
    if (state.selected.has(key)) state.selected.delete(key); else state.selected.add(key);
    saveSelected(); renderResults(); renderSelected(); renderStats(); renderOutputCategories(); renderOutput();
  }
  function renderSelected() {
    const root = $("#selected-list"); root.replaceChildren();
    const items = state.tags.filter(t => state.selected.has(norm(t.tag)));
    if (!items.length) {
      const empty = document.createElement("div"); empty.className = "selected-empty"; empty.textContent = "タグ一覧の「＋」から追加してください。";
      root.append(empty); return;
    }
    items.forEach(t => {
      const chip = document.createElement("div"); chip.className = "selected-chip";
      const name = document.createElement("span"); name.textContent = t.tag;
      const jp = document.createElement("small"); jp.textContent = t.ja || categoryText(t); name.append(jp);
      const remove = makeButton("×", "remove-chip", () => toggleSelected(t)); remove.setAttribute("aria-label", t.tag + "を解除");
      chip.append(name, remove); root.append(chip);
    });
  }
  function renderOutputCategories() {
    const root = $("#output-categories"); root.replaceChildren();
    const chosen = state.tags.filter(t => state.selected.has(norm(t.tag)));
    const majors = [...new Set(chosen.map(majorOf))];
    if (!majors.length) { root.hidden = true; return; }
    root.hidden = false;
    const validMajors = new Set(majors);
    [...state.outputExcluded].forEach(major => { if (!validMajors.has(major)) state.outputExcluded.delete(major); });
    majors.forEach(major => {
      const included = !state.outputExcluded.has(major);
      const b = makeButton(major, "include-chip" + (included ? " active" : ""), () => {
        if (state.outputExcluded.has(major)) state.outputExcluded.delete(major);
        else state.outputExcluded.add(major);
        b.classList.toggle("active", !state.outputExcluded.has(major));
        renderOutput();
      });
      b.dataset.major = major; b.title = "出力対象のカテゴリを切り替え"; root.append(b);
    });
  }
  function outputComment(major) {
    const en = enMajor[major] || major;
    const label = $("#category-language").value === "en" ? en : major;
    const style = $("#comment-style").value;
    if (style === "block") return "/* " + label + " */";
    if (style === "hash") return "# " + label;
    return "// " + label;
  }
  function renderOutput() {
    const selected = state.tags.filter(t => state.selected.has(norm(t.tag)));
    const group = $("#group-by-category").checked, comments = $("#include-comments").checked;
    const activeCats = new Set([...$("#output-categories").querySelectorAll(".include-chip.active")].map(b => b.dataset.major));
    const hasCategoryFilters = $("#output-categories").querySelectorAll(".include-chip").length > 0;
    const output = []; let count = 0;
    if (group) {
      const map = new Map();
      selected.forEach(t => {
        const m = majorOf(t);
        if (!hasCategoryFilters || activeCats.has(m)) { if (!map.has(m)) map.set(m, []); map.get(m).push(t); }
      });
      const sortedMajors = [...map.keys()].sort((a, b) => {
        const ia = CATEGORIES.findIndex(c => c[0] === a), ib = CATEGORIES.findIndex(c => c[0] === b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, "ja");
      });
      sortedMajors.forEach(major => {
        if (comments) output.push(outputComment(major));
        output.push(map.get(major).map(t => t.tag).join(", "));
        count += map.get(major).length;
      });
    } else {
      const tags = selected.filter(t => !hasCategoryFilters || activeCats.has(majorOf(t)));
      output.push(tags.map(t => t.tag).join(", ")); count = tags.length;
    }
    $("#prompt-output").value = output.filter(s => s !== "").join("\n");
    $("#output-count").textContent = count + " tags";
    $("#copy-output").disabled = count === 0; $("#download-output").disabled = count === 0;
  }
  function renderAll() { renderStats(); renderCategories(); renderResults(); renderSelected(); renderOutputCategories(); renderOutput(); }

  function parseJsonData(text, filename) {
    const parsed = JSON.parse(text), incoming = [];
    if (Array.isArray(parsed)) parsed.forEach(x => incoming.push(x));
    else if (parsed && typeof parsed === "object") {
      const gloss = parsed.gloss || parsed.translations;
      if (gloss && typeof gloss === "object" && !Array.isArray(gloss)) {
        Object.entries(gloss).forEach(([tag, ja]) => incoming.push({ tag, ja: String(ja || ""), category: ["未分類", "未分類"], source: filename }));
      } else if (Array.isArray(parsed.tags)) parsed.tags.forEach(x => incoming.push(x));
      else if (Array.isArray(parsed.data)) parsed.data.forEach(x => incoming.push(x));
    }
    return incoming;
  }
  function parsePerchanceText(text, filename) {
    const incoming = [];
    const parseBlock = name => {
      const start = text.indexOf("var " + name + " = [");
      if (start < 0) return "";
      const from = text.indexOf("[", start), end = text.indexOf("];", from);
      return end < 0 ? "" : text.slice(from, end + 1);
    };
    const main = parseBlock("TAGS");
    const rowRe = /\[\s*"((?:\\.|[^"\\])*)"\s*,\s*"((?:\\.|[^"\\])*)"\s*,\s*"([a-z])"\s*\]/g;
    const cats = {
      q:["画風・品質","品質"], s:["画風・品質","画風"], p:["人物","属性"],
      b:["髪・目・体","髪型"], c:["服装","衣類"], a:["ポーズ・動作","行動"],
      g:["背景・場所","自然"], l:["光・色彩","照明"], m:["構図・視点","構図"],
      o:["光・色彩","色"], x:["その他","物・自然"], r:["成人向け","身体・衣類"]
    };
    let m;
    while ((m = rowRe.exec(main))) {
      const tag = m[1].replace(/\\(["\\])/g, "$1"), ja = m[2].replace(/\\(["\\])/g, "$1");
      incoming.push({ tag, ja, category: cats[m[3]] || ["未分類", "未分類"], source: filename });
    }
    const adult = parseBlock("NSFW_TAGS"), ar = /\[\s*"((?:\\.|[^"\\])*)"\s*,\s*"((?:\\.|[^"\\])*)"\s*\]/g;
    while ((m = ar.exec(adult))) incoming.push({ tag:m[1], ja:m[2], category:["成人向け","身体・衣類"], source:filename });
    return incoming;
  }
  async function importFiles() {
    const files = $("#data-files").files;
    if (!files.length) { setStatus("import-status", "ファイルを選択してください。", true); return; }
    const incoming = [], errors = [];
    for (const file of files) {
      try {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith(".json")) incoming.push(...parseJsonData(text, file.name));
        else incoming.push(...parsePerchanceText(text, file.name));
      } catch (e) { errors.push(file.name + ": " + e.message); }
    }
    if (!incoming.length) {
      setStatus("import-status", "タグを読み取れませんでした。JSONの形式を確認してください。" + (errors.length ? " " + errors.join(" / ") : ""), true);
      return;
    }
    state.tags = mergeTags(state.tags, incoming, $("#replace-import").checked);
    if ($("#save-import").checked) saveData();
    const keys = new Set(state.tags.map(t => norm(t.tag)));
    state.selected = new Set([...state.selected].filter(k => keys.has(k)));
    saveSelected(); state.page = 0; renderAll();
    setStatus("import-status", incoming.length.toLocaleString("ja-JP") + "件の候補を読み込み、重複を統合しました。現在 " + state.tags.length.toLocaleString("ja-JP") + "件です。");
    setTimeout(() => closeDialog("import-dialog"), 900);
  }
  function openDialog(id) {
    const d = $("#" + id);
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }
  function closeDialog(id) {
    const d = $("#" + id);
    if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
  }
  function populateCustomCategories() {
    const major = $("#custom-major"), minor = $("#custom-minor"); major.replaceChildren();
    CATEGORIES.filter(c => c[0] !== "未分類").forEach(c => {
      const o = document.createElement("option"); o.value = c[0]; o.textContent = c[0]; major.append(o);
    });
    function setMinors() {
      minor.replaceChildren();
      (defaultMinor[major.value] || ["未分類"]).forEach(m => {
        const o = document.createElement("option"); o.value = m; o.textContent = m; minor.append(o);
      });
    }
    major.addEventListener("change", setMinors); setMinors();
  }
  function saveCustomTag() {
    const tag = $("#custom-tag").value.trim(), ja = $("#custom-ja").value.trim();
    const major = $("#custom-major").value, minor = $("#custom-minor").value;
    if (!tag) { setStatus("custom-status", "英語タグを入力してください。", true); return; }
    if (state.tags.some(t => norm(t.tag) === norm(tag))) { setStatus("custom-status", "同じタグが既に登録されています。", true); return; }
    const aliases = $("#custom-alias").value.split(",").map(s => s.trim()).filter(Boolean);
    state.tags = mergeTags(state.tags, [{ tag, ja, category: [major, minor], aliases, source: "custom" }]);
    state.selected.add(norm(tag)); saveData(); saveSelected(); renderAll();
    ["custom-tag", "custom-ja", "custom-alias"].forEach(id => $("#" + id).value = "");
    setStatus("custom-status", "タグを追加しました。");
    setTimeout(() => closeDialog("custom-dialog"), 400);
  }
  function downloadText() {
    const blob = new Blob([$("#prompt-output").value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "prompt-tags.txt"; a.click(); URL.revokeObjectURL(url);
  }
  async function copyOutput() {
    const value = $("#prompt-output").value;
    try { await navigator.clipboard.writeText(value); setStatus("copy-status", "コピーしました。"); }
    catch {
      const ta = $("#prompt-output"); ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      setStatus("copy-status", ok ? "コピーしました。" : "出力欄を選択して手動でコピーしてください。", !ok);
    }
  }
  function wire() {
    const presets = {
      anime: ["1girl", "solo", "long hair", "smile", "looking at viewer", "beautiful detailed eyes"],
      portrait: ["portrait", "upper body", "looking at viewer", "soft lighting", "smile"],
      fullbody: ["full body", "standing", "simple background", "looking at viewer"],
      quality: ["masterpiece", "best quality", "anime coloring", "beautiful detailed eyes"]
    };
    document.querySelectorAll("[data-preset]").forEach(button => {
      button.addEventListener("click", () => {
        const names = presets[button.dataset.preset] || [];
        const byName = new Map(state.tags.map(t => [norm(t.tag), t]));
        let added = 0;
        names.forEach(name => {
          const tag = byName.get(norm(name));
          if (tag && !state.selected.has(norm(tag.tag))) { state.selected.add(norm(tag.tag)); added++; }
        });
        saveSelected(); renderAll();
        setStatus("copy-status", added ? added + "件のタグを追加しました。" : "このセットのタグはすでに選択済みです。");
      });
    });
    $("#search").addEventListener("input", e => { state.query = e.target.value; state.page = 0; renderResults(); });
    $("#search").addEventListener("keydown", e => { if (e.key === "Enter") { state.query = e.target.value; state.page = 0; renderResults(); } });
    $("#sort-order").addEventListener("change", () => { state.columnSort = null; state.page = 0; renderResults(); });
    document.querySelectorAll("[data-column-sort]").forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.columnSort;
        state.columnSort = { key, dir: state.columnSort?.key === key ? -state.columnSort.dir : 1 };
        state.page = 0; renderResults();
      });
    });
    $("#level-filter").addEventListener("change", () => { state.page = 0; renderResults(); });
    $("#page-size").addEventListener("change", () => { state.page = 0; renderResults(); });
    $("#clear-category").addEventListener("click", () => { state.category = null; state.page = 0; renderAll(); });
    $("#prev-page").addEventListener("click", () => { state.page = Math.max(0, state.page - 1); renderResults(); });
    $("#next-page").addEventListener("click", () => { state.page++; renderResults(); });
    $("#clear-selected").addEventListener("click", () => { state.selected.clear(); saveSelected(); renderAll(); });
    ["group-by-category", "include-comments", "category-language", "comment-style"].forEach(id => $( "#" + id).addEventListener("change", () => { renderOutputCategories(); renderOutput(); }));
    $("#copy-output").addEventListener("click", copyOutput); $("#download-output").addEventListener("click", downloadText);
    $("#import-open").addEventListener("click", () => { setStatus("import-status", ""); openDialog("import-dialog"); });
    $("#import-cancel").addEventListener("click", () => closeDialog("import-dialog"));
    $("#import-run").addEventListener("click", importFiles);
    $("#custom-open").addEventListener("click", () => { setStatus("custom-status", ""); openDialog("custom-dialog"); });
    $("#custom-cancel").addEventListener("click", () => closeDialog("custom-dialog"));
    $("#custom-save").addEventListener("click", saveCustomTag);
    $("#data-note-close").addEventListener("click", () => closeDialog("data-note-dialog"));
    $("#show-data-note").addEventListener("click", () => openDialog("data-note-dialog"));
  }
  async function init() {
    wire(); populateCustomCategories();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      state.tags = saved ? JSON.parse(saved) : await seedTags();
      if (!Array.isArray(state.tags)) state.tags = [];
    } catch (e) { state.tags = await seedTags().catch(() => []); }
    try { state.selected = new Set(JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]")); } catch {}
    normalizeRecords(); renderAll();
  }
  init();
})();