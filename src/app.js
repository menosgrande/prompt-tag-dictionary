(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const STORAGE_KEY = "ptd.dictionary.v1";
  const SELECTED_KEY = "ptd.selected.v1";
  const REVIEW_KEY = "ptd.review.v1";
  let reviewRatings = {};
  const PAGE_SIZE = 100;
  function pageSize() { return PAGE_SIZE; }
  const CATEGORIES = [
    ["人物","People","人数","性別・体形","年齢","頭髪","顔・表情","目","胸","身体・部位","種族・役割"],
    ["作品・キャラクター","Works & Characters","作品名・シリーズ","キャラクター","作者・配信者"],
    ["背景・場所","Background & Location","屋内","施設","自然","都市","時間・天候"],
    ["構図・視点","Composition & Camera","構図","撮影範囲","カメラ角度","視点"],
    ["画風・品質","Style & Quality","画風","品質","描写技法","媒体"],
    ["光・色彩","Light & Color","照明","色","色調"],
    ["服装","Clothing","衣類","靴","小物","下着・水着","装備"],
    ["ポーズ・動作","Pose & Action","姿勢","行動","手の動き","対人動作"],
    ["シチュエーション","Situation","関係性","日常","イベント","成人向け状況"],
    ["その他","Other","動物","物","自然物","記号・効果"],
    ["成人向け","Adult","身体・衣類","行為・状況","表現・修正"],
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
  const state = { tags: [], selected: new Set(), category: null, page: 0, query: "", outputExcluded: new Set(), columnSort: null, expandedMajor: null, expandedMinor: null };

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
      tag: obj[0], ja: obj[1] || "",
      category: obj.length >= 5 ? [obj[2], obj[3], obj[4]] : obj.length >= 4 ? [obj[2], obj[3]] : undefined
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
      tag, ja: String(item.ja ?? item.japanese ?? item.gloss ?? item.j ?? ""),
      category, aliases, explanation: String(item.explanation ?? item.description ?? ""),
      related: Array.isArray(item.related) ? item.related : [],
      preview: String(item.preview ?? item.image ?? ""),
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
  function seedTags() {
    return fetch("./data/tags.json").then(r => {
      if (!r.ok) throw new Error("seed data missing");
      return r.json();
    }).then(rows => {
      if (!Array.isArray(rows)) throw new Error("seed data is not an array");
      return rows.map(raw => {
        if (Array.isArray(raw)) {
          return {
            tag: raw[0], ja: raw[1] || "",
            category: raw.length >= 5 ? [raw[2], raw[3], raw[4]] : raw.length >= 4 ? [raw[2], raw[3]] : undefined,
            source: SEED_SOURCE, sources: [SEED_SOURCE]
          };
        }
        return { ...raw, source: raw.source || SEED_SOURCE, sources: combineSources(raw.sources || [], [raw.source || SEED_SOURCE]) };
      });
    });
  }
  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tags)); }
    catch (e) { setStatus("import-status", "ブラウザの保存容量を超えたため、今回のデータは保存できませんでした。", true); }
  }
  function saveSelected() { try { localStorage.setItem(SELECTED_KEY, JSON.stringify([...state.selected])); } catch {} }
  function majorOf(t) { return (t.category && t.category[0]) || "未分類"; }
  function minorOf(t) { return (t.category && t.category[1]) || "未分類"; }
  function detailOf(t) { return (t.category && t.category[2]) || "—"; }
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
  }
  function categoryCounts() {
    const counts = new Map();
    state.tags.forEach(t => {
      const major = majorOf(t), minor = minorOf(t), detail = detailOf(t);
      if (!counts.has(major)) counts.set(major, { total: 0, minors: new Map() });
      const entry = counts.get(major);
      entry.total++;
      if (!entry.minors.has(minor)) entry.minors.set(minor, { total: 0, details: new Map() });
      const m = entry.minors.get(minor); m.total++;
      if (detail && detail !== "—") m.details.set(detail, (m.details.get(detail) || 0) + 1);
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
      const ia = CATEGORIES.findIndex(c => c[0] === a), ib = CATEGORIES.findIndex(c => c[0] === b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, "ja");
    });
    const addCount = (parent, value) => {
      const count = document.createElement("span");
      count.className = "count"; count.textContent = value.toLocaleString("ja-JP"); parent.append(count);
    };
    majors.forEach(major => {
      const entry = counts.get(major) || { total: 0, minors: new Map() };
      const wrap = document.createElement("div"); wrap.className = "category-major";
      const heading = document.createElement("div"); heading.className = "category-major-heading";
      const btn = document.createElement("button"); btn.className = "category-major-button"; btn.type = "button";
      if (state.category?.[0] === major && !state.category?.[1]) btn.classList.add("active");
      btn.setAttribute("aria-pressed", String(state.category?.[0] === major && !state.category?.[1]));
      const label = document.createElement("span"); label.textContent = major; btn.append(label); addCount(btn, entry.total);
      btn.addEventListener("click", () => {
        state.category = state.category?.[0] === major && !state.category?.[1] ? null : [major, null, null];
        state.page = 0; renderAll();
      });
      const expander = makeButton(state.expandedMajor === major ? "▾" : "▸", "category-expander", () => {
        state.expandedMajor = state.expandedMajor === major ? null : major;
        renderCategories();
      });
      expander.setAttribute("aria-label", major + "の小分類を展開");
      expander.setAttribute("aria-expanded", String(state.expandedMajor === major));
      heading.append(btn, expander); wrap.append(heading);
      if (state.expandedMajor === major) {
        const known = defaultMinor[major] || [];
        const minors = [...new Set([...known, ...entry.minors.keys()])];
        if (major !== "人物" && major !== "未分類") minors.splice(0, minors.length, ...minors.filter(m => entry.minors.has(m)));
        const minWrap = document.createElement("div"); minWrap.className = "category-minors";
        minors.forEach(minor => {
          const me = entry.minors.get(minor) || { total: 0, details: new Map() };
          const details = [...new Set([...(DETAIL_GROUPS[major]?.[minor] || []), ...me.details.keys()])].filter(d => me.details.has(d));
          const key = major + "::" + minor;
          const row = document.createElement("div"); row.className = "category-minor-row";
          const mb = document.createElement("button"); mb.type = "button"; mb.className = "category-minor";
          const minorActive = state.category?.[0] === major && state.category?.[1] === minor && !state.category?.[2];
          if (minorActive) mb.classList.add("active");
          const ml = document.createElement("span"); ml.textContent = minor;
          mb.append(ml); addCount(mb, me.total);
          mb.setAttribute("aria-pressed", String(minorActive));
          mb.addEventListener("click", () => {
            state.category = minorActive ? [major, null, null] : [major, minor, null];
            state.expandedMinor = key;
            state.page = 0; renderAll();
          });
          row.append(mb);
          if (details.length) {
            const de = makeButton(state.expandedMinor === key ? "▾" : "▸", "category-expander category-detail-expander", () => {
              state.expandedMinor = state.expandedMinor === key ? null : key; renderCategories();
            });
            de.setAttribute("aria-label", major + "、" + minor + "の詳細分類を展開");
            de.setAttribute("aria-expanded", String(state.expandedMinor === key)); row.append(de);
          } else row.append(document.createElement("span"));
          minWrap.append(row);
          if (details.length && state.expandedMinor === key) {
            const detailWrap = document.createElement("div"); detailWrap.className = "category-details";
            details.forEach(detail => {
              const db = document.createElement("button"); db.type = "button"; db.className = "category-detail";
              const active = state.category?.[0] === major && state.category?.[1] === minor && state.category?.[2] === detail;
              if (active) db.classList.add("active");
              const dl = document.createElement("span"); dl.textContent = detail; db.append(dl); addCount(db, me.details.get(detail) || 0);
              db.setAttribute("aria-pressed", String(active));
              db.addEventListener("click", () => {
                state.category = active ? [major, minor, null] : [major, minor, detail];
                state.page = 0; renderAll();
              });
              detailWrap.append(db);
            });
            minWrap.append(detailWrap);
          }
        });
        wrap.append(minWrap);
      }
      root.append(wrap);
    });
  }
  function matchingTags() {
    const q = norm(state.query), queryTerms = q.split(/\\s+/).filter(Boolean);
    const level = $("#level-filter").value, reviewFilter = $("#review-filter").value;
    let list = state.tags.filter(t => {
      if (state.category && (majorOf(t) !== state.category[0] || (state.category[1] && minorOf(t) !== state.category[1]) || (state.category[2] && detailOf(t) !== state.category[2]))) return false;
      if (level === "known" && majorOf(t) === "未分類") return false;
      if (level === "unknown" && majorOf(t) !== "未分類") return false;
      const rating = reviewRatings[norm(t.tag)] || {};
      const hasRating = ["tag", "translation", "category"].some(key => rating[key] === 1 || rating[key] === -1);
      if (reviewFilter === "unreviewed" && hasRating) return false;
      if (reviewFilter === "review-tag" && rating.tag !== -1) return false;
      if (reviewFilter === "review-category" && rating.category !== -1) return false;
      if (reviewFilter === "review-translation" && rating.translation !== -1) return false;
      if (reviewFilter === "review-any" && !(rating.tag === -1 || rating.category === -1 || rating.translation === -1 || majorOf(t) === "未分類" || !t.ja)) return false;
      if (!q) return true;
      const hay = norm([t.tag, t.ja, ...(t.aliases || []), ...(t.related || [])].join(" "));
      // Treat whitespace-separated words as AND terms, regardless of order.
      // Japanese queries without spaces remain a single substring search.
      return queryTerms.every(term => hay.includes(term));
    });
    const sort = $("#sort-order").value;
    const englishCompare = (a, b) => a.tag.localeCompare(b.tag, "en", { sensitivity: "base" });
    // Keep punctuation-based emoticons/kaomoji from dominating the initial list.
    const defaultCompare = (a, b) => {
      const rank = tag => /^[a-z]/i.test(tag) ? 0 : /^\d/.test(tag) ? 1 : 2;
      return rank(a.tag) - rank(b.tag) || englishCompare(a, b);
    };
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
        if (queryTerms.every(term => tag.includes(term) || ja.includes(term))) return 2;
        return 3;
      };
      return score(a) - score(b) || englishCompare(a, b);
    });
    else list.sort(defaultCompare);
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
              : key === "element3"
                ? (a, b) => compareText(a, b, t => detailOf(t))
                : key === "category"
                  ? (a, b) => compareText(a, b, t => majorOf(t) + " " + minorOf(t) + " " + detailOf(t))
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
    const all = matchingTags(), size = pageSize(all.length), pageCount = Math.max(1, Math.ceil(all.length / size));
    state.page = Math.min(Math.max(0, state.page), pageCount - 1);
    const start = state.page * size, items = all.slice(start, start + size), root = $("#tag-results");
    root.replaceChildren();
    const clearFilters = $("#clear-filters");
    if (clearFilters) {
      clearFilters.disabled = !(state.query.trim() || state.category ||
        $("#level-filter").value !== "all" || $("#review-filter").value !== "all");
    }

    // Display shared tag prefixes as a visual tree only. Data, selection keys and
    // prompt output always keep the complete original tag string.
    const prefixTreeEnabled = !state.columnSort && ["relevance", "english"].includes($("#sort-order").value);
    const pageTagIndexes = new Map(items.map((item, index) => [norm(item.tag), index]));
    const prefixParents = new Map();
    if (prefixTreeEnabled) {
      items.forEach((item, index) => {
        const words = norm(item.tag).split(/\s+/).filter(Boolean);
        for (let length = words.length - 1; length > 0; length--) {
          const parentIndex = pageTagIndexes.get(words.slice(0, length).join(" "));
          if (parentIndex !== undefined && parentIndex < index) {
            prefixParents.set(index, parentIndex);
            break;
          }
        }
      });
    }
    const prefixChildren = new Map();
    prefixParents.forEach((parentIndex, childIndex) => {
      if (!prefixChildren.has(parentIndex)) prefixChildren.set(parentIndex, []);
      prefixChildren.get(parentIndex).push(childIndex);
    });
    const lastPrefixChild = new Set([...prefixChildren.values()].map(children => children[children.length - 1]));
    const prefixDepth = index => {
      let depth = 0, cursor = index;
      while (prefixParents.has(cursor) && depth < 8) {
        cursor = prefixParents.get(cursor);
        depth++;
      }
      return depth;
    };
    document.querySelectorAll("[data-column-sort]").forEach(button => {
      const key = button.dataset.columnSort;
      const label = button.dataset.label;
      button.textContent = label + (state.columnSort?.key === key ? (state.columnSort.dir === 1 ? " ↑" : " ↓") : " ↕");
      button.setAttribute("aria-sort", state.columnSort?.key === key ? (state.columnSort.dir === 1 ? "ascending" : "descending") : "none");
    });
    $("#results-title").textContent = state.query ? "検索結果" : state.category ? categoryText({ category: state.category }) : "タグ一覧";
    $("#result-count").textContent = all.length.toLocaleString("ja-JP") + "件";
    $("#empty-state").hidden = all.length !== 0; root.hidden = all.length === 0;
    items.forEach((t, index) => {
      const row = document.createElement("div"); row.className = "tag-row";
      const parentIndex = prefixParents.get(index);
      const check = document.createElement("input");
      check.type = "checkbox"; check.className = "tag-check";
      check.checked = state.selected.has(norm(t.tag));
      check.setAttribute("aria-label", (check.checked ? "選択解除 " : "選択 ") + t.tag);
      check.addEventListener("change", () => toggleSelected(t));
      const english = document.createElement("span"); english.className = "tag-english";
      const tagLabel = document.createElement("div"); tagLabel.className = "tag-label-wrap";
      if (parentIndex !== undefined) {
        const parent = items[parentIndex];
        const parentWordCount = norm(parent.tag).split(/\s+/).filter(Boolean).length;
        const displayWords = String(t.tag).replace(/_/g, " ").trim().split(/\s+/).filter(Boolean);
        english.textContent = displayWords.slice(parentWordCount).join(" ") || t.tag;
        row.classList.add("tag-row-branch");
        tagLabel.classList.add("tag-prefix-child");
        tagLabel.style.marginInlineStart = (Math.min(prefixDepth(index), 8) * 10) + "px";
        const marker = document.createElement("span");
        marker.className = "tag-branch-marker";
        marker.textContent = lastPrefixChild.has(index) ? "└─" : "├─";
        marker.setAttribute("aria-hidden", "true");
        tagLabel.append(marker);
      } else {
        english.textContent = t.tag;
      }
      english.title = t.tag;
      english.setAttribute("aria-label", t.tag);
      const japanese = document.createElement("span"); japanese.className = "tag-japanese"; japanese.textContent = t.ja || "—";
      japanese.title = t.ja || "";
      tagLabel.append(english);
      const japaneseWrap = document.createElement("div"); japaneseWrap.className = "tag-japanese-wrap";
      japaneseWrap.append(japanese);
      const categoryWrap = document.createElement("div"); categoryWrap.className = "tag-category-wrap";
      const categoryTrail = document.createElement("span");
      categoryTrail.className = "tag-category tag-category-trail";
      categoryTrail.textContent = [majorOf(t), minorOf(t) !== "未分類" ? minorOf(t) : "", detailOf(t) !== "—" ? detailOf(t) : ""].filter(Boolean).join(" › ");
      categoryTrail.title = categoryTrail.textContent;
      categoryWrap.append(categoryTrail);
      const current = reviewRatings[norm(t.tag)] || {};
      function appendVotes(target, label, key) {
        const group = document.createElement("span");
        group.className = "vote-group inline-vote-group";
        [["👍", 1, "vote-up"], ["👎", -1, "vote-down"]].forEach(([symbol, value, direction]) => {
          const vote = makeButton(symbol, "vote-button " + direction + (current[key] === value ? " active" : ""), () => {
            const item = { ...(reviewRatings[norm(t.tag)] || {}) };
            if (item[key] === value) delete item[key]; else item[key] = value;
            if (!item.tag && !item.translation && !item.category) delete reviewRatings[norm(t.tag)];
            else reviewRatings[norm(t.tag)] = item;
            try { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewRatings)); } catch {}
            renderResults();
          });
          vote.setAttribute("aria-label", label + (value === 1 ? "を良いと評価" : "を要確認と評価"));
          vote.title = label + (value === 1 ? "：良い" : "：要確認");
          vote.setAttribute("aria-pressed", String(current[key] === value));
          group.append(vote);
        });
        target.append(group);
      }
      appendVotes(tagLabel, "タグ " + t.tag, "tag");
      appendVotes(japaneseWrap, "日本語訳 " + (t.ja || "訳なし"), "translation");
      appendVotes(categoryWrap, "分類 " + minorOf(t), "category");
      row.append(check, tagLabel, japaneseWrap, categoryWrap);
      row.title = t.explanation || t.tag;
      root.append(row);
    });
    $("#page-summary").textContent = all.length
      ? (start + 1).toLocaleString("ja-JP") + "–" + Math.min(start + size, all.length).toLocaleString("ja-JP") + "件 / " + all.length.toLocaleString("ja-JP") + "件（" + (state.page + 1) + "/" + pageCount + "ページ）"
      : "0件";
    $("#page-prev").disabled = state.page <= 0;
    $("#page-next").disabled = state.page >= pageCount - 1;
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
    const add = raw => {
      if (Array.isArray(raw)) {
        incoming.push({
          tag: raw[0], ja: raw[1] || "",
          category: raw.length >= 5 ? [raw[2], raw[3], raw[4]] : raw.length >= 4 ? [raw[2], raw[3]] : undefined,
          source: filename, sources: [filename]
        });
      } else if (typeof raw === "string") {
        incoming.push({ tag: raw, source: filename, sources: [filename] });
      } else if (raw && typeof raw === "object") {
        incoming.push({
          ...raw,
          source: raw.source || filename,
          sources: combineSources(raw.sources || [], [filename])
        });
      }
    };
    if (Array.isArray(parsed)) parsed.forEach(add);
    else if (parsed && typeof parsed === "object") {
      const gloss = parsed.gloss || parsed.translations;
      if (gloss && typeof gloss === "object" && !Array.isArray(gloss)) {
        Object.entries(gloss).forEach(([tag, ja]) => incoming.push({
          tag, ja: String(ja || ""), category: ["未分類", "未分類"],
          source: filename, sources: [filename]
        }));
      } else if (Array.isArray(parsed.tags)) parsed.tags.forEach(add);
      else if (Array.isArray(parsed.data)) parsed.data.forEach(add);
    }
    return incoming;
  }
  function parsePerchanceText(text, filename) {
    const incoming = [];
    const parseBlock = name => {
      const declaration = new RegExp("\\b(?:var|let|const)\\s+" + name + "\\s*=\\s*\\[");
      const match = declaration.exec(text);
      if (!match) return "";
      const from = text.indexOf("[", match.index + match[0].length - 1);
      if (from < 0) return "";
      let depth = 0, quote = "", escaped = false;
      for (let i = from; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === quote) quote = "";
          continue;
        }
        if (ch === "'" || ch === '"') { quote = ch; continue; }
        if (ch === "[") depth++;
        else if (ch === "]" && --depth === 0) return text.slice(from, i + 1);
      }
      return "";
    };
    const main = parseBlock("TAGS");
    const rowRe = /\[\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*,\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*,\s*(?:"([a-z])"|'([a-z])')\s*\]/g;
    const cats = {
      q:["画風・品質","品質"], s:["画風・品質","画風"], p:["人物","属性"],
      b:["髪・目・体","髪型"], c:["服装","衣類"], a:["ポーズ・動作","行動"],
      g:["背景・場所","自然"], l:["光・色彩","照明"], m:["構図・視点","構図"],
      o:["光・色彩","色"], x:["その他","物・自然"], r:["成人向け","身体・衣類"]
    };
    let m;
    while ((m = rowRe.exec(main))) {
      const rawTag = m[1] ?? m[2], rawJa = m[3] ?? m[4], code = m[5] ?? m[6];
      const tag = rawTag.replace(/\\(["'\\])/g, "$1"), ja = rawJa.replace(/\\(["'\\])/g, "$1");
      incoming.push({ tag, ja, category: cats[code] || ["未分類", "未分類"], source: filename });
    }
    const adult = parseBlock("NSFW_TAGS"), ar = /\[\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*,\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*\]/g;
    while ((m = ar.exec(adult))) {
      const tag = (m[1] ?? m[2]).replace(/\\(["'\\])/g, "$1");
      const ja = (m[3] ?? m[4]).replace(/\\(["'\\])/g, "$1");
      incoming.push({ tag, ja, category:["成人向け","身体・衣類"], source:filename });
    }
    return incoming;
  }
  async function importFiles() {
    const files = [...$("#data-files").files].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
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
    const preferIncoming = $("#prefer-import").checked;
    state.tags = mergeTags(state.tags, incoming, $("#replace-import").checked, { preferIncoming });
    $("#replace-import").checked = false;
    $("#prefer-import").checked = false;
    if ($("#save-import").checked) saveData();
    const keys = new Set(state.tags.map(t => norm(t.tag)));
    state.selected = new Set([...state.selected].filter(k => keys.has(k)));
    saveSelected(); state.page = 0; renderAll();
    const stats = lastMergeStats || {};
    const conflictNotes = [];
    const policyText = preferIncoming ? "今回のデータを優先" : "先に登録された値を保持";
    if (stats.translationConflicts) conflictNotes.push("訳の競合 " + stats.translationConflicts + "件（" + policyText + "）");
    if (stats.categoryConflicts) conflictNotes.push("分類の競合 " + stats.categoryConflicts + "件（" + policyText + "）");
    if (errors.length) {
      const examples = errors.slice(0, 3).join(" / ");
      conflictNotes.push("読み込み失敗 " + errors.length + "ファイル: " + examples + (errors.length > 3 ? " ほか" + (errors.length - 3) + "件" : ""));
    }
    const conflictText = conflictNotes.length ? " 要確認: " + conflictNotes.join("、") + "。" : "";
    setStatus("import-status", incoming.length.toLocaleString("ja-JP") + "件の候補を読み込み、重複を統合しました。現在 " + state.tags.length.toLocaleString("ja-JP") + "件です。" + conflictText, conflictNotes.length > 0);
    if (!conflictNotes.length) setTimeout(() => closeDialog("import-dialog"), 900);
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
    const major = $("#custom-major"), minor = $("#custom-minor"), detail = $("#custom-detail");
    major.replaceChildren();
    CATEGORIES.filter(c => c[0] !== "未分類").forEach(c => {
      const o = document.createElement("option"); o.value = c[0]; o.textContent = c[0]; major.append(o);
    });
    function setDetails() {
      detail.replaceChildren();
      const options = DETAIL_GROUPS[major.value]?.[minor.value] || [];
      (options.length ? options : ["—"]).forEach(v => {
        const o = document.createElement("option"); o.value = v; o.textContent = v; detail.append(o);
      });
    }
    function setMinors() {
      minor.replaceChildren();
      (defaultMinor[major.value] || ["未分類"]).forEach(m => {
        const o = document.createElement("option"); o.value = m; o.textContent = m; minor.append(o);
      });
      setDetails();
    }
    major.addEventListener("change", setMinors);
    minor.addEventListener("change", setDetails);
    setMinors();
  }
  function saveCustomTag() {
    const tag = $("#custom-tag").value.trim(), ja = $("#custom-ja").value.trim();
    const major = $("#custom-major").value, minor = $("#custom-minor").value, detail = $("#custom-detail").value;
    if (!tag) { setStatus("custom-status", "英語タグを入力してください。", true); return; }
    if (state.tags.some(t => norm(t.tag) === norm(tag))) { setStatus("custom-status", "同じタグが既に登録されています。", true); return; }
    const aliases = $("#custom-alias").value.split(",").map(s => s.trim()).filter(Boolean);
    state.tags = mergeTags(state.tags, [{ tag, ja, category: [major, minor, detail], aliases, source: "custom" }]);
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
      portrait: ["portrait", "upper body", "looking at viewer", "soft lighting", "smile"],
      landscape: ["landscape", "scenery", "sky", "clouds", "wide shot"],
      lighting: ["wide shot", "backlighting", "depth of field", "rim light"],
      quality: ["masterpiece", "best quality", "illustration", "ultra detailed"]
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
    $("#page-prev").addEventListener("click", () => {
      if (state.page > 0) { state.page--; renderResults(); }
    });
    $("#page-next").addEventListener("click", () => {
      state.page++; renderResults();
    });
    document.querySelectorAll("[data-column-sort]").forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.columnSort;
        state.columnSort = { key, dir: state.columnSort?.key === key ? -state.columnSort.dir : 1 };
        state.page = 0; renderResults();
      });
    });
    ["level-filter", "review-filter"].forEach(id => $("#" + id).addEventListener("change", () => { state.page = 0; renderResults(); }));
    $("#clear-filters").addEventListener("click", () => {
      state.query = "";
      state.category = null;
      state.page = 0;
      $("#search").value = "";
      $("#level-filter").value = "all";
      $("#review-filter").value = "all";
      renderAll();
      $("#search").focus();
    });
    $("#clear-category").addEventListener("click", () => { state.category = null; state.page = 0; renderAll(); });
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
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
    try {
      const seed = await seedTags();
      if (saved) {
        const parsed = JSON.parse(saved);
        state.tags = Array.isArray(parsed)
          ? mergeTags(parsed, seed, false, { seedRefresh: true })
          : seed;
        saveData();
      } else state.tags = seed;
    } catch (e) {
      try {
        const parsed = saved ? JSON.parse(saved) : null;
        state.tags = Array.isArray(parsed) ? parsed : [];
      } catch { state.tags = []; }
      if (!state.tags.length) state.tags = await seedTags().catch(() => []);
    }
    try { state.selected = new Set(JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]")); } catch {}
    try { reviewRatings = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}") || {}; } catch { reviewRatings = {}; }
    normalizeRecords(); renderAll();
  }
  init();
})();