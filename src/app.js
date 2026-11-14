(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const STORAGE_KEY = "ptd.dictionary.v1";
  const SELECTED_KEY = "ptd.selected.v1";
  const REVIEW_KEY = "ptd.review.v1";
  let reviewRatings = {};
  let promptOrderOverrides = new Map();
  let promptTargetOverrides = new Map();
  let tagTaxonomy = null;
  let dictionaryData = null;
  let classificationCandidates = new Map();
  const PAGE_SIZE = 100;
  const MOBILE_PAGE_SIZE = 200;
  function pageSize() {
    return window.matchMedia("(max-width: 720px)").matches ? MOBILE_PAGE_SIZE : PAGE_SIZE;
  }
  const CATEGORIES = [
    ["人物","People","人数","性別・体形","年齢","頭髪","顔・表情","目","胸","身体・部位","種族・役割"],
    ["作品・キャラクター","Works & Characters","作品名・シリーズ","キャラクター","作者・配信者"],
    ["服装","Clothing","衣類","靴","小物","下着・水着","装備"],
    ["ポーズ・動作","Pose & Action","姿勢","行動","手の動き","対人動作"],
    ["シチュエーション","Situation","関係性","日常","イベント","成人向け状況"],
    ["背景・場所","Background & Location","屋内","施設","自然","都市","時間・天候"],
    ["構図・視点","Composition & Camera","構図","撮影範囲","カメラ角度","視点"],
    ["画風・品質","Style & Quality","画風","品質","描写技法","媒体"],
    ["光・色彩","Light & Color","照明","色","色調"],
    ["成人向け","Adult","身体・衣類","行為・状況","表現・修正"],
    ["その他","Other","動物","物","自然物","記号・効果"],
    ["未分類","Uncategorized","未分類"]
  ];
  const enMajor = Object.fromEntries(CATEGORIES.map(c => [c[0], c[1]]));
  const defaultMinor = Object.fromEntries(CATEGORIES.map(c => [c[0], c.slice(2)]));
  const DETAIL_GROUPS = {
    "人物": {
      "人数":["単独・1人","2人","複数人","群衆"],
      "性別・体形":["女性","男性","中性的","体格・体形","身長・体格"],
      "年齢":["幼年・子供","若年","成人","高齢"],
      "頭髪":["髪型","髪の長さ","髪色","髪質","髪の状態","髪飾り"],
      "顔・表情":["表情","口・唇","鼻","眉","肌・そばかす","顔の装飾","顔の輪郭"],
      "目":["目の色","目の形","瞳・瞳孔","視線","まつ毛・アイメイク"],
      "胸":["胸の大きさ","胸元・谷間","胸の状態・形"],
      "身体・部位":["頭・首","腕・手","脚・足","胴体","皮膚・身体の特徴"],
      "種族・役割":["人外・異種族","動物的特徴","職業・役割","性格・属性"]
    },
    "服装": {
      "衣類":["上半身","下半身","全身衣装","制服・職業服","素材・柄","状態・装飾","その他"],
      "靴":["靴の種類","ヒール・高さ","靴下・脚周り","その他"],
      "小物":["アクセサリー","頭部アクセサリー","眼鏡・マスク","バッグ・持ち物","その他"],
      "下着・水着":["下着","水着","ランジェリー","その他"],
      "装備":["武器","防具","携行装備","その他"]
    },
    "ポーズ・動作": {
      "姿勢":["立つ・歩く","座る・しゃがむ","寝る・横たわる","膝立ち・跪く","その他"],
      "行動":["日常動作","身体動作","スポーツ・運動","食事・飲み物","その他"],
      "手の動き":["手の形・指","手を振る・指差す","手を使う動作","その他"],
      "対人動作":["抱擁・接触","キス・親密動作","対立・攻撃","共同動作","その他"]
    },
    "構図・視点": {
      "構図":["中央・配置","左右・上下配置","前景・背景","対称・反復","その他"],
      "撮影範囲":["顔アップ","バストアップ","上半身","全身","遠景"],
      "カメラ角度":["正面・横・後ろ","俯瞰・あおり","斜め・傾き","その他"],
      "視点":["一人称","第三者視点","主観・POV","その他"]
    },
    "シチュエーション": {
      "関係性":["単独","家族・友人","恋愛・親密","集団・対立","その他"],
      "日常":["学校・仕事","家・生活","趣味・娯楽","その他"],
      "イベント":["季節・祝祭","式典・行事","旅行・外出","その他"],
      "成人向け状況":["露出・脱衣","親密・接触","その他"]
    },
    "背景・場所": {
      "屋内":["家・部屋","学校・職場","店舗・施設","その他"],
      "施設":["学校","医療・公共施設","商業・娯楽施設","交通機関","その他"],
      "自然":["森林・草原","山・岩","水辺・海","空・宇宙","その他"],
      "都市":["街路・建物","住宅街","都市景観","その他"],
      "時間・天候":["時間帯","晴雨・雲","風・雪","季節","その他"]
    },
    "画風・品質": {
      "画風":["アニメ・漫画","イラスト","写真・写実","特定スタイル","その他"],
      "品質":["高品質タグ","低品質タグ","解像度・精細","透かし・ノイズ","その他"],
      "描写技法":["線画・塗り","陰影・質感","輪郭・ディテール","その他"],
      "媒体":["デジタル","伝統画材","3D・CG","その他"]
    },
    "光・色彩": {
      "照明":["自然光","人工光","逆光・縁取り","柔らかい光","影","その他"],
      "色":["色名","配色","色の付いた物体","その他"],
      "色調":["暖色・寒色","彩度・明度","モノクロ","その他"]
    },
    "その他": {
      "動物":["哺乳類","鳥・魚・爬虫類","架空生物","動物の部位","その他"],
      "物":["家具・室内用品","日用品","武器・道具","乗り物","その他"],
      "自然物":["植物","水・空・地形","鉱物・素材","その他"],
      "記号・効果":["記号","発光・粒子","線・衝撃","その他"]
    },
    "成人向け": {
      "身体・衣類":["下着・衣類","胸・身体","露出・濡れ","その他"],
      "行為・状況":["行為","体勢","複数人・関係","その他"],
      "表現・修正":["検閲","画面表現","その他"]
    }
  };
  const ADMIN_MODE = false; // 編集は admin.html に集約。通常辞典は常に閲覧専用。
  let tagGroups = [];
  let nsfwAudit = new Map();
  const state = { tags: [], selected: new Set(), category: null, excludedCategories: new Set(), page: 0, query: "", outputExcluded: new Set(), columnSort: null, expandedMajor: null, expandedMinor: null, expandedWorkGroups: new Set(), editMode: ADMIN_MODE, editingTag: null };
  const outputHistory = { undo: [], redo: [], last: { positive: "", negative: "" } };

  function norm(s) {
    return String(s ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
  }
  function splitCategory(raw) {
    if (Array.isArray(raw)) return [String(raw[0] || "未分類"), String(raw[1] || "未分類"), String(raw[2] || "—")];
    if (typeof raw === "string" && raw) {
      const parts = raw.split(/[/>／|]/).map(s => s.trim()).filter(Boolean);
      return [parts[0] || "未分類", parts[1] || "未分類", parts[2] || "—"];
    }
    return ["未分類", "未分類", "—"];
  }
  function inferPersonMinor(t) {
    const has = re => re.test(t);
    if (has(/\b(1girl|1boy|solo|single person|one person|2girls|2boys|two girls|two boys|multiple girls|multiple boys|crowd)\b/)) return "人数";
    if (has(/\b(breast|breasts|boob|boobs|chest|cleavage|bust)\b/)) return "胸";
    if (has(/\b(eye|eyes|eyebrow|eyelash|pupil|iris|heterochromia|eyeliner|eyeshadow|sclera|wide-eyed)\b/)) return "目";
    if (has(/\b(hair|haired|hairstyle|bangs|braid|ponytail|bun|ahoge|twintail|twintails|bob cut|bald|shaved head|wig|hair ornament)\b/)) return "頭髪";
    if (has(/\b(smile|grin|frown|blush|blushing|expression|angry|annoyed|crying|tears|wink|grimace|smirk|open mouth|closed mouth|mouth|lips|nose|freckles|facial mark|worried|surprised|sad|happy|embarrassed|yawning|pouting)\b/)) return "顔・表情";
    if (has(/\b(baby|child|kid|teen|teenager|young|elderly|old woman|old man|middle-aged)\b/)) return "年齢";
    if (has(/\b(angel|demon|devil|alien|android|robot|elf|vampire|witch|fairy|mermaid|kemonomimi|animal ears|horns|wings|werewolf|zombie|youkai|yokai)\b/)) return "種族・役割";
    if (has(/\b(girl|boy|woman|man|female|male|feminine|masculine|androgynous|muscular|slim|thick|curvy|petite|tall|short stature|body type|wide hips|narrow waist)\b/)) return "性別・体形";
    if (has(/\b(hand|hands|finger|fingers|arm|arms|leg|legs|foot|feet|shoulder|shoulders|torso|abdomen|navel|skin|body|thigh|thighs|knees|neck)\b/)) return "身体・部位";
    return "種族・役割";
  }
  function inferClothingMinor(t, fallback = "衣類") {
    if (/\b(swimsuit|bikini|swimwear|one-piece swimsuit|school swimsuit|swim trunks)\b/.test(t)) return "下着・水着";
    if (/\b(bra|panties|underwear|lingerie|bloomers|boxers|pantyhose|garter|thong|briefs|bustier|corset|camisole|babydoll)\b/.test(t)) return "下着・水着";
    if (/\b(shoe|shoes|boots|sneakers|heels|sandals|slippers|loafers|footwear|socks|stockings|thighhighs|leg warmers)\b/.test(t)) return "靴";
    if (/\b(earrings|necklace|bracelet|ring|choker|brooch|hairpin|hairclip|hair clip|ribbon|bowtie|necktie|glasses|eyewear|mask|bag|backpack|purse|handbag|hat|cap|crown|headband|headdress|hair ornament)\b/.test(t)) return "小物";
    if (/\b(sword|gun|weapon|armor|armour|shield|holster|scabbard|quiver|spear|dagger|axe)\b/.test(t)) return "装備";
    return ["衣類", "靴", "小物", "下着・水着", "装備"].includes(fallback) ? fallback : "衣類";
  }
  function inferDetail(tag, major, minor) {
    const t = norm(tag);
    const has = re => re.test(t);
    const color = "(black|white|blonde|blond|red|blue|green|pink|purple|silver|gray|grey|brown|orange|yellow|gold|golden|cyan|magenta|rainbow|multicolored|two-tone)";
    if (major === "人物") {
      if (minor === "人数") return /\b(crowd)\b/.test(t) ? "群衆" : /\b(2girls|2boys|two girls|two boys|couple|duo|pair)\b/.test(t) ? "2人" : /\b(multiple|group|several|many girls|many boys)\b/.test(t) ? "複数人" : "単独・1人";
      if (minor === "性別・体形") return /\b(woman|women|girl|girls|female|feminine|lady|ladies)\b/.test(t) ? "女性" : /\b(man|men|boy|boys|male|masculine|gentleman)\b/.test(t) ? "男性" : /\b(androgynous|genderless|nonbinary|non-binary)\b/.test(t) ? "中性的" : /\b(tall|short stature|petite|height|long legs|short legs)\b/.test(t) ? "身長・体格" : "体格・体形";
      if (minor === "年齢") return /\b(baby|infant|toddler|child|kid|loli|shota)\b/.test(t) ? "幼年・子供" : /\b(teen|teenager|adolescent|young)\b/.test(t) ? "若年" : /\b(elderly|old man|old woman|old person|aged)\b/.test(t) ? "高齢" : "成人";
      if (minor === "頭髪") return /\b(hair ornament|hairpin|hair pin|hairclip|hair clip|hair ribbon|hair flower|hair bow|hairband|headband)\b/.test(t) ? "髪飾り" : new RegExp("\\b" + color + "\\s*(colored|color)?\\s*(hair|haired)\\b|\\b(hair color|colored hair|gradient hair|two-tone hair|multicolored hair)\\b").test(t) ? "髪色" : /\b(long|short|very long|very short|medium|waist-length|knee-length|floor-length) hair\b/.test(t) ? "髪の長さ" : /\b(wavy|curly|straight|curled|frizzy|coiled|silky|spiky|fluffy) hair\b/.test(t) ? "髪質" : /\b(ponytail|twintail|twintails|braid|braided|bun|bob cut|pixie cut|ahoge|bangs|parted hair|sidelocks|drill hair|hime cut|mohawk|undercut|bald|shaved head|wig)\b/.test(t) ? "髪型" : "髪の状態";
      if (minor === "目") return new RegExp("\\b" + color + "\\s*(colored|color)?\\s*(eyes|eye)\\b|\\b(eye color)\\b").test(t) ? "目の色" : /\b(eyelash|eyelashes|eyeliner|eyeshadow|mascara|false eyelashes)\b/.test(t) ? "まつ毛・アイメイク" : /\b(pupil|pupils|iris|irises|sclera|heterochromia|x-shaped pupils|star-shaped pupils|heart-shaped pupils)\b/.test(t) ? "瞳・瞳孔" : /\b(looking|gaze|staring|looking away|looking at viewer|closed eyes|half-closed eyes|squinting|cross-eyed|wide-eyed)\b/.test(t) ? "視線" : "目の形";
      if (minor === "顔・表情") return /\b(smile|grin|frown|blush|blushing|angry|annoyed|crying|tears|wink|grimace|smirk|expression|worried|surprised|sad|happy|embarrassed|disgusted|laughing|yawning|pouting)\b/.test(t) ? "表情" : /\b(mouth|lips|lipstick|teeth|fangs|tongue|drooling)\b/.test(t) ? "口・唇" : /\b(nose|nostrils|snout)\b/.test(t) ? "鼻" : /\b(eyebrow|eyebrows)\b/.test(t) ? "眉" : /\b(freckles|mole|moles|skin|wrinkles|rosy cheeks)\b/.test(t) ? "肌・そばかす" : /\b(face paint|facial mark|face tattoo|face sticker|face scar|scar on face)\b/.test(t) ? "顔の装飾" : "顔の輪郭";
      if (minor === "胸") return /\b(cleavage|plunging neckline|deep neckline)\b/.test(t) ? "胸元・谷間" : /\b(flat chest|small breasts|medium breasts|large breasts|huge breasts|gigantic breasts|breast size)\b/.test(t) ? "胸の大きさ" : "胸の状態・形";
      if (minor === "身体・部位") return /\b(hand|hands|finger|fingers|arm|arms|wrist|elbow|shoulder|shoulders)\b/.test(t) ? "腕・手" : /\b(leg|legs|foot|feet|toe|toes|thigh|thighs|knees|calves|ankle)\b/.test(t) ? "脚・足" : /\b(head|neck|ear|ears|chin|jaw|skull)\b/.test(t) ? "頭・首" : /\b(torso|abdomen|stomach|back|waist|hip|hips|navel|belly|ribcage)\b/.test(t) ? "胴体" : "皮膚・身体の特徴";
      if (minor === "種族・役割") return /\b(angel|demon|devil|alien|android|robot|elf|vampire|witch|fairy|mermaid|kemonomimi|werewolf|zombie|youkai|yokai|dragon girl|dragon boy)\b/.test(t) ? "人外・異種族" : /\b(ears|tail|horns|wings|fur|scales|animal)\b/.test(t) ? "動物的特徴" : /\b(teacher|student|doctor|nurse|maid|chef|police|soldier|wizard|knight|idol|artist|magical girl)\b/.test(t) ? "職業・役割" : "性格・属性";
    }
    if (major === "服装") {
      if (minor === "下着・水着") return /\b(swimsuit|bikini|swimwear|swim trunks|school swimsuit)\b/.test(t) ? "水着" : /\b(lingerie|babydoll|bustier|corset)\b/.test(t) ? "ランジェリー" : "下着";
      if (minor === "靴") return /\b(heel|heels|high heels|platform shoes|wedge heels)\b/.test(t) ? "ヒール・高さ" : /\b(socks|stockings|pantyhose|thighhighs|leg warmers)\b/.test(t) ? "靴下・脚周り" : "靴の種類";
      if (minor === "小物") return /\b(hat|cap|crown|headband|headdress|hair ornament|hairpin|hair clip|hairclip)\b/.test(t) ? "頭部アクセサリー" : /\b(glasses|eyewear|mask)\b/.test(t) ? "眼鏡・マスク" : /\b(bag|backpack|purse|handbag|briefcase)\b/.test(t) ? "バッグ・持ち物" : /\b(earrings|necklace|bracelet|ring|choker|brooch|ribbon|bowtie|necktie)\b/.test(t) ? "アクセサリー" : "その他";
      if (minor === "装備") return /\b(sword|gun|weapon|bow|arrow|spear|staff|dagger|axe)\b/.test(t) ? "武器" : /\b(armor|armour|helmet|shield|gauntlet|greaves)\b/.test(t) ? "防具" : "携行装備";
      if (minor === "衣類") return /\b(shirt|blouse|jacket|coat|sweater|hoodie|cardigan|vest|sleeves|blazer|cape|tunic|top)\b/.test(t) ? "上半身" : /\b(skirt|pants|trousers|shorts|jeans|leggings)\b/.test(t) ? "下半身" : /\b(dress|gown|jumpsuit|bodysuit|kimono|uniform|costume|suit|robe|onesie)\b/.test(t) ? "全身衣装" : /\b(wet|dirty|torn|ripped|transparent|see-through|latex|leather|denim|lace|silk|wool|knit|striped|plaid|polka-dot|floral)\b/.test(t) ? "素材・柄" : "その他";
    }
    if (major === "ポーズ・動作") {
      if (minor === "姿勢") return /\b(sitting|sit|seiza|squat|squatting|crouching)\b/.test(t) ? "座る・しゃがむ" : /\b(lying|lie down|sleeping|on back|on stomach|prone|supine)\b/.test(t) ? "寝る・横たわる" : /\b(kneeling|on knees|kneel)\b/.test(t) ? "膝立ち・跪く" : /\b(walking|standing|running|stepping)\b/.test(t) ? "立つ・歩く" : "その他";
      if (minor === "手の動き") return /\b(waving|pointing|peace sign|thumbs up|middle finger|finger gun)\b/.test(t) ? "手を振る・指差す" : /\b(finger|fingers|hands?|hand gesture|clenched fist|open hand)\b/.test(t) ? "手の形・指" : "手を使う動作";
      if (minor === "対人動作") return /\b(kiss|kissing)\b/.test(t) ? "キス・親密動作" : /\b(fight|fighting|punch|punching|kick|kicking)\b/.test(t) ? "対立・攻撃" : /\b(hug|hugging|embrace|holding hands)\b/.test(t) ? "抱擁・接触" : "共同動作";
      return /\b(eating|drinking|cooking|reading|writing|using phone|working|cleaning)\b/.test(t) ? "日常動作" : /\b(sport|running|jumping|dancing|swimming|martial arts|weightlifting)\b/.test(t) ? "スポーツ・運動" : "身体動作";
    }
    if (major === "構図・視点") {
      if (minor === "撮影範囲") return /\b(close-up|close up|face focus|headshot|portrait)\b/.test(t) ? "顔アップ" : /\b(bust shot|upper body|cowboy shot|chest up)\b/.test(t) ? "バストアップ" : /\b(full body|long shot|wide shot|whole body)\b/.test(t) ? "全身" : /\b(extreme long shot|distant view|far away|landscape shot)\b/.test(t) ? "遠景" : "上半身";
      if (minor === "カメラ角度") return /\b(from above|high angle|bird's-eye view|overhead view|top-down|looking down|from below|low angle|worm's-eye view|looking up)\b/.test(t) ? "俯瞰・あおり" : /\b(dutch angle|tilted|diagonal)\b/.test(t) ? "斜め・傾き" : "正面・横・後ろ";
      if (minor === "視点") return /\b(pov|first person|viewer perspective|subjective view)\b/.test(t) ? "主観・POV" : "第三者視点";
      return /\b(left|right|center|centered|symmetrical|foreground|background)\b/.test(t) ? "左右・上下配置" : "中央・配置";
    }
    if (major === "背景・場所") {
      if (minor === "時間・天候") return /\b(night|midnight|evening|sunset|sunrise|dawn|dusk|daytime|morning|noon)\b/.test(t) ? "時間帯" : /\b(rain|rainy|snow|snowing|storm|cloud|cloudy|fog|mist|wind|windy)\b/.test(t) ? "晴雨・雲" : /\b(spring|summer|autumn|fall|winter)\b/.test(t) ? "季節" : "風・雪";
      if (minor === "自然") return /\b(sea|ocean|beach|lake|river|waterfall|shore|underwater)\b/.test(t) ? "水辺・海" : /\b(mountain|rock|cliff|canyon|cave)\b/.test(t) ? "山・岩" : /\b(sky|space|starfield|cloud|planet|galaxy)\b/.test(t) ? "空・宇宙" : "森林・草原";
      if (minor === "都市") return /\b(street|road|alley|sidewalk|crosswalk|cityscape|skyline|building)\b/.test(t) ? "街路・建物" : /\b(residential|suburb|neighborhood)\b/.test(t) ? "住宅街" : "都市景観";
      return /\b(school|hospital|store|shop|restaurant|train station|airport|office|classroom)\b/.test(t) ? "学校・職場" : /\b(house|bedroom|living room|kitchen|bathroom)\b/.test(t) ? "家・部屋" : "店舗・施設";
    }
    if (major === "画風・品質") {
      if (minor === "品質") return /\b(worst quality|low quality|lowres|blurry|jpeg artifacts|watermark|signature)\b/.test(t) ? (/\b(watermark|signature)\b/.test(t) ? "透かし・ノイズ" : "低品質タグ") : /\b(highres|high quality|best quality|masterpiece|absurdres|ultra-detailed)\b/.test(t) ? "高品質タグ" : "解像度・精細";
      if (minor === "画風") return /\b(anime|manga|comic)\b/.test(t) ? "アニメ・漫画" : /\b(photo|photorealistic|realistic|realism)\b/.test(t) ? "写真・写実" : "イラスト";
      if (minor === "媒体") return /\b(3d|cgi|render|blender)\b/.test(t) ? "3D・CG" : /\b(oil painting|watercolor|pencil|ink|pastel|charcoal)\b/.test(t) ? "伝統画材" : "デジタル";
      return /\b(lineart|line art|cel shading|soft shading|crosshatching|rendering|gradient)\b/.test(t) ? "線画・塗り" : "陰影・質感";
    }
    if (major === "光・色彩") {
      if (minor === "照明") return /\b(backlight|rim light|silhouette|edge lighting)\b/.test(t) ? "逆光・縁取り" : /\b(shadow|shadows|cast shadow|hard light)\b/.test(t) ? "影" : /\b(soft light|soft lighting|diffuse light|ambient light)\b/.test(t) ? "柔らかい光" : /\b(sunlight|natural light|moonlight|daylight)\b/.test(t) ? "自然光" : "人工光";
      if (minor === "色調") return /\b(monochrome|grayscale|greyscale|black and white)\b/.test(t) ? "モノクロ" : /\b(saturation|vibrant|muted|pastel|high contrast|low contrast|brightness)\b/.test(t) ? "彩度・明度" : "暖色・寒色";
      return /\b(color palette|complementary colors|color scheme|duotone|gradient)\b/.test(t) ? "配色" : "色名";
    }
    if (major === "その他") {
      if (minor === "動物") return /\b(dragon|griffin|phoenix|unicorn|monster|mythical)\b/.test(t) ? "架空生物" : /\b(bird|fish|snake|lizard|turtle|frog|eagle|owl)\b/.test(t) ? "鳥・魚・爬虫類" : /\b(ear|tail|paw|wing|fang|claw|fur|feather|scale)\b/.test(t) ? "動物の部位" : "哺乳類";
      if (minor === "自然物") return /\b(flower|tree|plant|grass|leaf|leaves|mushroom|vine|flowerbed)\b/.test(t) ? "植物" : /\b(water|river|sea|ocean|sky|mountain|field|forest|lake)\b/.test(t) ? "水・空・地形" : "鉱物・素材";
      if (minor === "記号・効果") return /\b(glow|spark|particle|impact|speed lines|motion lines|aura|lightning|explosion)\b/.test(t) ? "発光・粒子" : /\b(line|effect|burst|slash|symbol|icon|emblem)\b/.test(t) ? "線・衝撃" : "記号";
      return /\b(chair|table|bed|sofa|desk|shelf|cabinet)\b/.test(t) ? "家具・室内用品" : /\b(car|train|airplane|bicycle|motorcycle|bus|ship)\b/.test(t) ? "乗り物" : "日用品";
    }
    if (major === "成人向け") {
      if (minor === "身体・衣類") return /\b(bra|panties|underwear|lingerie|clothes|dress|skirt|shirt|swimsuit)\b/.test(t) ? "下着・衣類" : /\b(breast|breasts|boob|boobs|chest|cleavage|body)\b/.test(t) ? "胸・身体" : /\b(wet|nude|naked|exposed|transparent|see-through)\b/.test(t) ? "露出・濡れ" : "その他";
      if (minor === "行為・状況") return /\b(position|lying|kneeling|standing|sitting|on top|underneath)\b/.test(t) ? "体勢" : /\b(two|three|multiple|group|couple|partner)\b/.test(t) ? "複数人・関係" : "行為";
      return /\b(censored|censor|mosaic|pixelated|bar censor|black bar)\b/.test(t) ? "検閲" : "画面表現";
    }
    return "—";
  }
  function normalizeCategory(tag, category) {
    let [major, minor, detail] = category;
    const t = norm(tag);
    const oldPersonCategory = major === "髪・目・体" || major === "顔・表情";
    if (oldPersonCategory) {
      major = "人物";
      minor = inferPersonMinor(t);
    } else if (major === "人物") {
      if (!defaultMinor["人物"].includes(minor) || /属性|役割/.test(minor)) minor = inferPersonMinor(t);
      else if (minor === "人数" && !/\b(1girl|1boy|solo|2girls|2boys|two girls|two boys|multiple girls|multiple boys|crowd)\b/.test(t)) minor = inferPersonMinor(t);
    } else if (major === "成人向け" && /\b(breast|breasts|boob|boobs|chest|cleavage|bust)\b/.test(t)) {
      major = "人物"; minor = "胸";
    } else if (major === "光・色彩" && /\b(black|white|blonde|blond|red|blue|green|pink|purple|silver|gray|grey|brown|orange|yellow|gold|cyan|rainbow)[ -]?(colored|color)?[ -]?(hair|haired|eyes|eye)\b/.test(t)) {
      major = "人物"; minor = /\b(hair|haired)\b/.test(t) ? "頭髪" : "目";
    } else if (major === "光・色彩" && /\b(bikini|swimsuit|dress|skirt|shirt|blouse|jacket|coat|sweater|hoodie|cardigan|pants|shorts|jeans|bra|panties|underwear|boots|shoes|sandals|heels|hat|cap|glasses|necklace|earrings|ribbon|uniform|kimono|bodysuit|jumpsuit)\b/.test(t)) {
      major = "服装"; minor = inferClothingMinor(t);
    }
    if (major === "服装") minor = inferClothingMinor(t, minor);
    if (major === "その他" && !defaultMinor[major]?.includes(minor)) {
      if (/\b(cat|dog|bird|fish|snake|lizard|turtle|frog|wolf|fox|bear|horse|rabbit|mouse|whale|dolphin|dragon|griffin|phoenix|unicorn|monster|animal|beast)\b/.test(t)) minor = "動物";
      else if (/\b(flower|tree|plant|grass|leaf|leaves|mushroom|vine|water|river|sea|ocean|sky|mountain|field|forest|lake|rock|crystal|mineral)\b/.test(t)) minor = "自然物";
      else if (/\b(glow|spark|particle|impact|speed lines|motion lines|aura|lightning|explosion|symbol|icon|emblem)\b/.test(t)) minor = "記号・効果";
      else minor = "物";
    }
    if (major === "未分類" || !defaultMinor[major]) return [major || "未分類", minor || "未分類", "—"];
    if (!defaultMinor[major].includes(minor)) {
      if (major === "人物") minor = inferPersonMinor(t);
      else if (major === "服装") minor = inferClothingMinor(t, minor);
      else if (major === "その他") minor = "物";
      else minor = defaultMinor[major][0] || "未分類";
    }
    const choices = DETAIL_GROUPS[major]?.[minor] || [];
    if (!choices.length) return [major, minor, "—"];
    if (detail && detail !== "—" && choices.includes(detail)) return [major, minor, detail];
    const guess = inferDetail(t, major, minor);
    return [major, minor, choices.includes(guess) ? guess : choices.includes("その他") ? "その他" : choices[0]];
  }  const UNKNOWN_SOURCE = "unknown";
  const SEED_SOURCE = "seed:data/tags.json";
  let lastMergeStats = null;

  function normalizeSource(value) {
    const source = String(value ?? "").trim();
    // "import" was the old generic default, not a trustworthy file origin.
    return !source || source === "import" ? UNKNOWN_SOURCE : source;
  }
  function sourceList(item) {
    const values = [
      ...(Array.isArray(item?.sources) ? item.sources : []),
      item?.source
    ].map(normalizeSource).filter(source => source !== UNKNOWN_SOURCE);
    const unique = [...new Set(values)];
    return unique.length ? unique : [UNKNOWN_SOURCE];
  }
  function combineSources(...lists) {
    const known = [...new Set(lists.flat().map(normalizeSource).filter(source => source !== UNKNOWN_SOURCE))];
    return known.length ? known : [UNKNOWN_SOURCE];
  }
  function cleanTag(obj) {
    let item;
    if (typeof obj === "string") item = { tag: obj };
    else if (Array.isArray(obj)) item = {
      ...(obj[6] && typeof obj[6] === "object" && !Array.isArray(obj[6]) ? obj[6] : {}),
      tag: obj[0], ja: obj[1] || "",
      category: obj.length >= 5 ? [obj[2], obj[3], obj[4]] : obj.length >= 4 ? [obj[2], obj[3]] : undefined,
      aliases: Array.isArray(obj[5]) ? obj[5] : []
    };
    else item = obj || {};
    const tag = String(item.tag ?? item.t ?? item.english ?? item.name ?? "").trim();
    if (!tag) return null;
    const category = normalizeCategory(tag, splitCategory(item.category ?? item.categories ?? item.cat));
    const aliases = [...new Set([
      ...(Array.isArray(item.aliases) ? item.aliases : []),
      ...(Array.isArray(item.keywords) ? item.keywords : []),
      ...(Array.isArray(item.search) ? item.search : [])
    ].map(String).filter(Boolean))];
    const sources = sourceList(item);
    return {
      ...item,
      tag, ja: String(item.ja ?? item.japanese ?? item.gloss ?? item.j ?? ""),
      category, aliases, explanation: String(item.explanation ?? item.description ?? ""),
      related: Array.isArray(item.related) ? item.related : [],
      preview: String(item.preview ?? item.image ?? ""),
      rating: String(item.rating ?? item.nsfwLevel ?? ""),
      proposedRating: String(item.proposedRating ?? ""),
      ratingReviewStatus: String(item.ratingReviewStatus ?? ""),
      ratingReason: String(item.ratingReason ?? ""),
      nsfw: typeof item.nsfw === "boolean" ? item.nsfw : null,
      usage: String(item.usage ?? item.use ?? ""),
      examples: Array.isArray(item.examples) ? item.examples.map(String) : [],
      source: sources[0] || UNKNOWN_SOURCE, sources
    };
  }
  function isClassified(item) {
    return Boolean(item?.category?.[0] && item.category[0] !== "未分類");
  }
  function sameCategory(a, b) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  }
  function mergeTags(base, incoming, replace = false, options = {}) {
    const map = new Map();
    const stats = { input: incoming.length, added: 0, duplicates: 0, translationConflicts: 0, categoryConflicts: 0 };
    if (!replace) base.forEach(raw => {
      const item = cleanTag(raw);
      if (item) map.set(norm(item.tag), item);
    });
    incoming.forEach(raw => {
      const item = cleanTag(raw);
      if (!item) return;
      const key = norm(item.tag), prev = map.get(key);
      if (!prev) {
        map.set(key, item);
        stats.added++;
        return;
      }
      stats.duplicates++;
      if (prev.ja && item.ja && norm(prev.ja) !== norm(item.ja)) stats.translationConflicts++;
      if (isClassified(prev) && isClassified(item) && !sameCategory(prev.category, item.category)) stats.categoryConflicts++;

      // Refresh seed-only rows from the latest bundle; preserve imported/custom rows.
      const priorSources = sourceList(prev);
      const canRefreshSeed = options.seedRefresh &&
        priorSources.every(source => source === UNKNOWN_SOURCE || source === SEED_SOURCE) &&
        item.sources.includes(SEED_SOURCE);
      const sources = combineSources(priorSources, sourceList(item));
      const preferIncoming = options.preferIncoming === true;
      const chosenJa = canRefreshSeed || preferIncoming ? (item.ja || prev.ja) : (prev.ja || item.ja);
      const chosenCategory = (canRefreshSeed || preferIncoming) && isClassified(item)
        ? item.category
        : isClassified(prev) ? prev.category
          : isClassified(item) ? item.category : prev.category;

      map.set(key, {
        ...prev, ...item,
        ja: chosenJa,
        category: chosenCategory,
        aliases: [...new Set([...(prev.aliases || []), ...(item.aliases || [])])],
        explanation: prev.explanation || item.explanation,
        related: prev.related?.length ? prev.related : (item.related || []),
        preview: prev.preview || item.preview,
        source: sources[0] || UNKNOWN_SOURCE,
        sources
      });
    });
    lastMergeStats = stats;
    return [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag, "en", { sensitivity: "base" }));
  }
  function seedDictionaryData() {
    return fetch("./data/dictionary-data.json").then(r => {
      if (!r.ok) throw new Error("dictionary data missing");
      return r.json();
    }).then(data => {
      if (!data || data.schema !== "prompt-tag-dictionary-runtime-v1" || !Array.isArray(data.tags)) throw new Error("dictionary data invalid");
      dictionaryData = data;
      return data;
    });
  }
  function seedTags() {
    return Promise.resolve(dictionaryData?.tags).then(rows => {
      if (!Array.isArray(rows)) throw new Error("dictionary tags missing");
      if (!Array.isArray(rows)) throw new Error("seed data is not an array");
      return rows.map(raw => {
        if (Array.isArray(raw)) {
          const metadata = raw[6] && typeof raw[6] === "object" && !Array.isArray(raw[6]) ? raw[6] : {};
          return {
            ...metadata,
            tag: raw[0], ja: raw[1] || "",
            category: raw.length >= 5 ? [raw[2], raw[3], raw[4]] : raw.length >= 4 ? [raw[2], raw[3]] : undefined,
            aliases: Array.isArray(raw[5]) ? raw[5] : [],
            source: metadata.source || SEED_SOURCE,
            sources: combineSources(metadata.sources || [], [metadata.source || SEED_SOURCE])
          };
        }
        return { ...raw, source: raw.source || SEED_SOURCE, sources: combineSources(raw.sources || [], [raw.source || SEED_SOURCE]) };
      });
    });
  }
  function seedPromptOrder() {
    return Promise.resolve(dictionaryData?.promptOrder).then(data => {
      if (!data) throw new Error("prompt order data missing");
      const entries = Array.isArray(data.overrides) ? data.overrides : [];
      const ordered = Array.isArray(data.categories) ? data.categories.slice().sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)).map(x=>x&&x.name).filter(name=>typeof name==="string"&&name.trim()) : [];
      if (ordered.length) PROMPT_ORDER = [...new Set(ordered)];
      promptOrderOverrides = new Map(entries.filter(x => x && x.tag && x.category).map(x => [norm(x.tag), x.category]));
      promptTargetOverrides = new Map((Array.isArray(data.negative_tags) ? data.negative_tags : []).map(tag => [norm(tag), "negative"]));
    });
  }
  function seedTagGroups() {
    return Promise.resolve(Array.isArray(dictionaryData?.tagGroups) ? dictionaryData.tagGroups : []);
  }
  function seedNsfwAudit() {
    const rows = Array.isArray(dictionaryData?.nsfwAudit?.candidates) ? dictionaryData.nsfwAudit.candidates : [];
    nsfwAudit = new Map(rows.filter(item => item && item.tag).map(item => [norm(item.tag), item]));
    return Promise.resolve();
  }
  function seedTaxonomy() {
    const taxonomy = dictionaryData?.taxonomy;
    const candidates = dictionaryData?.classificationCandidates;
    if (!taxonomy || !candidates) throw new Error("taxonomy data missing");
    tagTaxonomy = taxonomy;
    classificationCandidates = new Map((Array.isArray(candidates.entries) ? candidates.entries : []).map(item => [norm(item.tag), item]));
    return Promise.resolve();
  }
  function classificationOf(t) {
    return classificationCandidates.get(norm(t.tag)) || null;
  }
  function taxonomyCategoryId(candidate) {
    if (!candidate?.categoryId) return "";
    const sub = candidate.subcategoryId;
    if (candidate.categoryId === "person") {
      if (sub === "people-count") return "people-count";
      if (["face-expression", "eyes"].includes(sub)) return "face";
      if (sub === "hair-head") return "hair";
    }
    if (candidate.categoryId === "background" && ["furniture", "object-items"].includes(sub)) return "objects";
    return candidate.categoryId;
  }
  function taxonomyCategoryName(id) { return tagTaxonomy?.semanticCategories?.find(category => category.id === id)?.name || ""; }
  function taxonomySubcategoryName(categoryId, subcategoryId) {
    const mappedCategoryId = taxonomyCategoryId({categoryId, subcategoryId});
    const mappedSubcategoryId = categoryId === "person" && subcategoryId === "people-count" ? "people-count-value"
      : categoryId === "person" && subcategoryId === "face-expression" ? "face-expression-core"
      : categoryId === "person" && subcategoryId === "eyes" ? "eyes-feature"
      : categoryId === "person" && subcategoryId === "hair-head" ? "hair-head-core"
      : categoryId === "background" && subcategoryId === "furniture" ? "furniture-items"
      : categoryId === "background" && subcategoryId === "object-items" ? "other-objects"
      : subcategoryId;
    return tagTaxonomy?.semanticCategories?.find(category => category.id === mappedCategoryId)?.subcategories?.find(sub => sub.id === mappedSubcategoryId)?.name || "";
  }
  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tags)); }
    catch (e) { setStatus("import-status", "ブラウザの保存容量を超えたため、今回のデータは保存できませんでした。", true); }
  }
  function saveSelected() { try { localStorage.setItem(SELECTED_KEY, JSON.stringify([...state.selected])); } catch {} }
  function majorOf(t) {
    const candidate = classificationOf(t);
    if (candidate?.status === "provisional" && candidate.categoryId) return taxonomyCategoryName(taxonomyCategoryId(candidate)) || "未分類";
    if (candidate?.status === "needs-review") return "未分類";
    const legacyMajor = (t.category && t.category[0]) || "未分類";
    const legacyMinor = (t.category && t.category[1]) || "";
    if (legacyMajor === "光・色彩") return "光・演出";
    if (legacyMajor === "人物") return "人物の特徴";
    if (legacyMajor === "作品・キャラクター") return "キャラクター・作品";
    if (legacyMajor === "服装") return "服装・装飾";
    if (legacyMajor === "ポーズ・動作") return legacyMinor === "姿勢" ? "ポーズ・姿勢" : "動作・接触";
    if (legacyMajor === "シチュエーション") return "動作・接触";
    if (legacyMajor === "背景・場所") return "背景・場所";
    if (legacyMajor === "構図・視点") return "構図・カメラ";
    if (legacyMajor === "画風・品質") return legacyMinor === "品質" ? "品質・ネガティブ" : "画風・描写";
    if (legacyMajor === "成人向け") return /身体・衣類/.test(legacyMinor) ? "服装・装飾" : "動作・接触";
    if (legacyMajor === "その他") return /動物/.test(legacyMinor) ? "生物・動植物" : /記号・効果/.test(legacyMinor) ? "文字・記号" : "背景・場所";
    return legacyMajor;
  }
  // Prompt assembly order is shared by the output UI and the category navigation.
  let PROMPT_ORDER = ["品質・ネガティブ", "人数・人物構成", "キャラクター・作品", "人物の特徴", "顔・表情", "髪・頭部", "服装・装飾", "ポーズ・姿勢", "動作・接触", "背景・場所", "家具・設備・物品", "乗り物", "構図・カメラ", "画風・描写", "光・演出", "生物・動植物", "文字・記号"];
  function promptTargetOf(t) { return promptTargetOverrides.get(norm(t.tag)) || "positive"; }
  function promptOrderOf(t) {
    if (promptTargetOf(t) === "negative") return PROMPT_ORDER[0];
    const override = promptOrderOverrides.get(norm(t.tag));
    const overrideAliases = {"人物・身体的特徴":"人物の特徴","背景・環境":"背景・場所","物品・小道具":"家具・設備・物品","生物・種族":"生物・動植物"};
    const normalizedOverride = overrideAliases[override] || override;
    if (PROMPT_ORDER.includes(normalizedOverride)) return normalizedOverride;
    const candidate = classificationOf(t);
    const taxonomyOutputIndex = tagTaxonomy?.semanticCategories?.find(category => category.id === taxonomyCategoryId(candidate))?.order - 1;
    if (candidate?.status === "provisional" && Number.isInteger(taxonomyOutputIndex) && taxonomyOutputIndex >= 0) return PROMPT_ORDER[taxonomyOutputIndex];
    const major = majorOf(t);
    const minor = minorOf(t);
    const tag = norm(t.tag);
    if (major === "画風・品質") {
      if (tag === "beautiful detailed eyes") return "顔・表情";
      if (tag === "detailed background") return "背景・場所";
      if (tag === "nsfw") return "動作・接触";
      if (["text", "signature", "username", "watermark", "wallpaper", "official art", "key visual"].includes(tag)) return "文字・記号";
      return minor === "品質" ? "品質・ネガティブ" : "画風・描写";
    }
    const legacyOrder = {
      "人物": "人物の特徴", "作品・キャラクター": "キャラクター・作品",
      "服装": "服装・装飾", "ポーズ・動作": minor === "姿勢" ? "ポーズ・姿勢" : "動作・接触",
      "シチュエーション": "動作・接触", "背景・場所": "背景・場所",
      "構図・視点": "構図・カメラ", "光・色彩": "光・演出",
      "成人向け": /身体・衣類/.test(minor) ? "服装・装飾" : /表現・修正/.test(minor) ? "光・演出" : "動作・接触",
      "その他": /動物/.test(minor) ? "生物・動植物" : /記号・効果/.test(minor) ? "光・演出" : "背景・場所"
    };
    if (legacyOrder[major]) return legacyOrder[major];
    return "未分類";
  }
  function minorOf(t) {
    const candidate = classificationOf(t);
    if (candidate?.status === "provisional" && candidate.categoryId) {
      return taxonomySubcategoryName(candidate.categoryId, candidate.subcategoryId) || "未分類";
    }
    if (candidate?.status === "needs-review") return "未分類";
    const legacyMajor = t.category?.[0] || "未分類";
    const legacyMinor = t.category?.[1] || "";
    if (legacyMajor === "光・色彩") {
      if (/(影|陰影)/.test(legacyMinor)) return "影・陰影";
      if (/(発光|演出|効果)/.test(legacyMinor)) return "演出効果";
      if (/(照明|光源|ライト|逆光)/.test(legacyMinor)) return "照明・光源";
      return "色調・色彩";
    }
    return legacyMinor || "未分類";
  }
  function detailOf(t) { return (t.category && t.category[2]) || "—"; }
  function displayClassification(t) {
    const candidate = classificationOf(t);
    if (candidate?.status === "provisional" && candidate.categoryId) {
      return {
        major: taxonomyCategoryName(taxonomyCategoryId(candidate)) || (t.category && t.category[0]) || "未分類",
        minor: taxonomySubcategoryName(candidate.categoryId, candidate.subcategoryId) || (t.category && t.category[1]) || "未分類",
        detail: (t.category && t.category[2]) || "—"
      };
    }
    if (candidate?.status === "needs-review") {
      return { major: "未分類", minor: "要確認", detail: (t.category && t.category[2]) || "—" };
    }
    return {
      major: majorOf(t),
      minor: minorOf(t),
      detail: (t.category && t.category[2]) || "—"
    };
  }
  function categoryText(t) {
    const a = majorOf(t), b = minorOf(t), c = detailOf(t);
    if (a === "未分類") return "未分類";
    return [a, b !== "未分類" ? b : "", c !== "—" ? c : ""].filter(Boolean).join(" › ");
  }
  function setStatus(id, msg, error = false) {
    const el = $("#" + id);
    if (el) { el.textContent = msg; el.style.color = error ? "var(--danger)" : "var(--accent)"; }
  }
  function normalizeRecords() { state.tags = mergeTags([], state.tags, true); }

  function renderStats() {
    $("#stat-total").textContent = state.tags.length.toLocaleString("ja-JP");
    $("#stat-selected").textContent = state.selected.size.toLocaleString("ja-JP");
    renderSelectedDock();
  }
  function expressionLevelInfoOf(t) {
    const level = Number.isInteger(t.expressionLevel) && t.expressionLevel >= 0 && t.expressionLevel <= 4
      ? t.expressionLevel : null;
    const review = t.expressionLevelReview || {};
    const labels = ["一般向け", "軽度の露出", "セクシー表現", "強い性的表現", "成人向け"];
    return {
      level,
      label: level === null ? "未判定" : labels[level],
      status: review.status || "unreviewed",
      reason: review.reason || ""
    };
  }
  function openTagInfo(t) {
    const dialog = $("#tag-info-dialog");
    const set = (id, value) => { const el = $("#" + id); if (el) el.textContent = value || "未登録"; };
    set("tag-info-name", t.tag);
    set("tag-info-ja", t.ja || "—");
    const displayed = displayClassification(t);
    set("tag-info-category", [displayed.major, displayed.minor, displayed.detail].filter(v => v && v !== "—").join(" › "));
    const expression = expressionLevelInfoOf(t);
    set("tag-info-rating", expression.level === null ? "未判定" : "レベル" + expression.level + "（" + expression.label + "）");
    set("tag-info-rating-status", expression.status === "verified" ? "確認済み" : "未確認");
    set("tag-info-rating-reason", expression.reason || "判定根拠はまだ登録されていません。");
    set("tag-info-meaning", t.explanation || "説明はまだ登録されていません。");
    set("tag-info-usage", t.usage || "用法はまだ登録されていません。");
    set("tag-info-examples", (t.examples || []).join(" / ") || "使用例はまだ登録されていません。");
    set("tag-info-source", (t.sources || []).join("、") || "出典情報なし");
    openDialog("tag-info-dialog");
  }
  function initColumnResizing() {
    const panel = $("#results-panel");
    const head = panel?.querySelector(".table-head");
    if (!panel || !head) return;
    const key = "ptd.tagColumns.v2";
    const defaults = [36, 190, 160, 120, 120, 120, 76, 58, 42];
    let widths = defaults.slice();
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(saved) && saved.length === defaults.length) widths = saved.map((v, i) => Math.max(32, Math.min(520, Number(v) || defaults[i])));
    } catch {}
    const save = () => { try { localStorage.setItem(key, JSON.stringify(widths)); } catch {} };
    const apply = () => {
      const template = widths.map((w, i) => (i === 0 || i >= 6 ? w + "px" : "minmax(70px," + w + "px)")).join(" ");
      panel.style.setProperty("--tag-list-columns", template);
      head.querySelectorAll(".column-resize").forEach(handle => {
        const index = Number(handle.dataset.columnIndex);
        handle.setAttribute("aria-valuemin", String(index === 0 ? 30 : index >= 7 ? 48 : 48));
        handle.setAttribute("aria-valuemax", "520");
        handle.setAttribute("aria-valuenow", String(Math.round(widths[index])));
      });
    };
    apply();
    head.querySelectorAll(".column-resize").forEach(handle => {
      const index = Number(handle.dataset.columnIndex);
      const min = index === 0 ? 30 : index >= 7 && index <= 9 ? 56 : 48;
      const resizeTo = value => {
        widths[index] = Math.max(min, Math.min(520, value));
        apply(); save();
      };
      handle.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          resizeTo(widths[index] + (event.key === "ArrowRight" ? 10 : -10));
        } else if (event.key === "Home") {
          event.preventDefault(); resizeTo(defaults[index]);
        }
      });
      handle.addEventListener("pointerdown", event => {
        event.preventDefault(); event.stopPropagation();
        const startX = event.clientX, startWidth = widths[index];
        const move = e => {
          widths[index] = Math.max(min, Math.min(520, startWidth + e.clientX - startX));
          apply();
        };
        const finish = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", finish);
          document.removeEventListener("pointercancel", finish);
          save();
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", finish, { once: true });
        document.addEventListener("pointercancel", finish, { once: true });
      });
      handle.addEventListener("dblclick", event => {
        event.preventDefault(); event.stopPropagation();
        resizeTo(defaults[index]);
      });
    });
  }
  function renderSelectedDock() { /* 選択中ドックは廃止。選択状態はプロンプト編集画面で確認する。 */ }\n;