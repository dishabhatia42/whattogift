// What each interest means in product words. Shoppers see short labels ("Coffee & tea"); the
// search looks for the words brands actually use in product names ("darjeeling", "pour over"),
// as whole words, and skips look-alikes ("tea towel" isn't tea, "notebook" isn't a book).
//
// Each interest: `words` that count as a match, and `not` for look-alikes that don't.
// Words are matched as whole words, plurals included ("mug" finds "mugs").

const CLOTHES = ["saree", "sari", "kurta", "kurti", "dress", "top", "shirt", "t-shirt", "tee", "blouse", "stole", "scarf", "scarves", "dupatta", "co-ord", "jacket", "skirt", "pants", "trousers", "loungewear", "kaftan", "lehenga", "jumpsuit", "shrug", "cardigan", "sweater", "hoodie", "pyjama", "pajama"];
const BAGS = ["bag", "tote", "wallet", "pouch", "clutch", "sling", "backpack", "card holder", "cardholder", "purse", "laptop sleeve", "duffle", "crossbody", "belt bag"];
const JEWELLERY = ["earring", "necklace", "bracelet", "ring", "pendant", "bangle", "anklet", "choker", "stud", "hoop", "jewellery", "jewelry", "cuff", "kada", "jhumka", "nose pin", "nosepin", "chain", "charm"];
const SKINCARE = ["skincare", "skin care", "serum", "moisturiser", "moisturizer", "face wash", "cleanser", "toner", "sunscreen", "spf", "lip balm", "body lotion", "body butter", "body oil", "body wash", "scrub", "face oil", "face mask", "soap", "bath", "hair oil", "shampoo", "conditioner", "cream", "ubtan", "kumkumadi"];
const MAKEUP = ["makeup", "lipstick", "lip tint", "kajal", "eyeliner", "mascara", "blush", "foundation", "highlighter", "nail polish", "nail paint", "concealer", "eyeshadow"];
const FRAGRANCE = ["perfume", "parfum", "edp", "eau de", "attar", "fragrance", "body mist", "cologne"];
const HOME = ["cushion", "throw", "blanket", "rug", "lamp", "candle", "vase", "decor", "wall art", "art print", "poster", "table runner", "coaster", "tray", "mirror", "clock", "diffuser", "bedsheet", "bedding", "quilt", "curtain", "pillow cover", "planter", "wall plate", "wallpaper", "showpiece", "bookend", "dhurrie"];
const KITCHEN = ["mug", "cup", "plate", "bowl", "platter", "serveware", "tableware", "dinnerware", "dinner set", "cutlery", "spoon", "kitchen", "jar", "glass", "tumbler", "coaster", "cookware", "pan", "kettle", "teapot", "apron", "napkin", "casserole", "sipper", "bottle", "chopping board", "spice box", "masala dabba"];
const NOT_KITCHEN_LOOKALIKE = ["tea light", "tealight", "tea-light", "hourglass", "sunglass", "wall plate", "cup & ball", "cup and ball"];
const ART_DIY = ["paint by number", "paint by numbers", "diy", "diamond art", "diamond painting", "embroidery", "crochet", "knitting", "clay", "colouring", "coloring", "sketchbook", "watercolour", "watercolor", "craft kit", "craft", "canvas", "macrame", "art kit", "painting kit", "pottery"];
const STATIONERY = ["journal", "notebook", "planner", "diary", "stationery", "pen", "pencil", "notecard", "sticker", "bookmark", "calendar", "notepad", "sketchbook", "washi", "fountain pen", "letter set"];
const BOOKS = ["book", "novel", "paperback", "hardcover", "hardback", "fiction", "poetry book", "comic", "graphic novel"];
const NOT_BOOKS = ["photo book", "photobook", "colouring book", "coloring book", "painting book", "painting a4 book", "sticker book", "log book", "book sleeve", "book cover", "bookend", "book holder", "book light", "lunch box"];
const FOOD = ["chocolate", "sweets", "mithai", "snack", "cookie", "biscuit", "nuts", "almond", "cashew", "pistachio", "dates", "honey", "jam", "granola", "toffee", "caramel", "dry fruit", "dry fruits", "laddoo", "laddu", "barfi", "halwa", "spice", "masala", "pickle", "achaar", "sauce", "cake", "brownie", "fudge", "candy", "gummies", "makhana", "chikki", "trail mix", "brittle", "bonbon", "praline", "truffle", "food hamper", "gourmet"];
const NOT_FOOD = ["candle", "soap", "scrub", "lip", "body", "bath", "perfume", "magnet", "keychain", "poster", "print", "book", "journal", "notebook", "t-shirt", "tee", "socks", "earring", "necklace", "box only", "empty gift box", "plushie", "toy", "game", "honey bee", "pen", "stand", "sticker", "planner", "diary", "stationery", "candle holder", "honey process", "card games", "board games", "chocolate brown", "lego"];
const COFFEE_TEA = ["coffee", "tea", "chai", "matcha", "darjeeling", "assam", "nilgiri", "oolong", "infusion", "tisane", "espresso", "brew", "pour over", "pour-over", "french press", "filter coffee", "cold brew", "latte", "kahwa", "chamomile", "green tea", "cafetiere", "moka pot", "aeropress", "dripper", "teapot", "tea set"];
const NOT_COFFEE_TEA = ["tea towel", "tea light", "tealight", "tea-light", "tea cosy", "coffee table", "coffee table book", "teaspoon"];
const PLANTS = ["plant", "planter", "succulent", "bonsai", "seeds", "gardening", "garden kit", "terrarium", "money plant", "snake plant", "pothos", "monstera", "fern", "cactus", "herb kit", "grow kit"];
const NOT_PLANTS = ["plant-based", "plant based", "plant protein"];
const GAMES = ["board game", "card game", "game", "puzzle", "jigsaw", "quiz", "trivia", "chess", "ludo", "carrom", "rubik", "dice", "party game", "drinking game"];
const TECH = ["headphone", "earbud", "earphone", "speaker", "soundbar", "bluetooth", "charger", "power bank", "gadget", "smartwatch", "keyboard", "mouse", "controller", "console", "gaming", "laptop stand", "phone stand", "controller stand", "headphone stand", "cable organiser", "tech"];
const TOYS = ["toy", "plush", "soft toy", "lego", "diecast", "toy car", "doll", "building blocks", "blocks", "playset", "action figure", "minifigure", "teddy"];
const PERSONAL = ["personalised", "personalized", "monogram", "monogrammed", "initials", "name engraved", "engraved with your name", "custom name", "your name", "name tag", "name plate", "photo book", "photobook", "custom portrait", "caricature"];
const NOT_PERSONAL = ["empty gift box", "item personalization", "item personalisation"];
const SPIRITUAL = ["puja", "pooja", "diya", "agarbatti", "incense", "dhoop", "idol", "ganesha", "ganesh", "krishna", "buddha", "spiritual", "prayer", "mala", "rudraksha", "temple", "sacred", "urli", "kalash", "lakshmi", "shiva"];

export const INTERESTS = {
  // ---- shown to shoppers today
  "fashion & style": { words: [...CLOTHES, ...BAGS, "sneaker", "shoe", "belt", "cap", "sunglasses", "hair clip", "claw clip", "scrunchie", "socks"] },
  "books & stories": { words: BOOKS, not: NOT_BOOKS },
  "home & cosy things": { words: [...HOME, "throw", "blanket", "candle", "mug", "slippers"] },
  "experiences": { words: ["experience", "tour", "workshop", "masterclass", "online course", "pottery class", "art class", "cooking class", "baking class", "dance class", "gift experience", "experience voucher", "tasting session", "coffee tasting", "tea tasting", "tickets", "retreat", "course"],
    not: ["kit", "machine", "pen", "ticket to ride", "diecast", "toy", "tote", "matcha", "game"] },
  "fitness & wellness": { words: ["yoga", "gym", "fitness", "workout", "sports", "wellness", "self-care", "selfcare", "self care", "meditation", "massage", "ayurvedic", "sleep", "protein", "yoga mat", "sipper", "resistance band", "foam roller", "dumbbell", "running"] },
  "all things tech": { words: TECH },
  "handmade & artsy": { words: ["handmade", "handcrafted", "hand-painted", "hand painted", "handwoven", "hand woven", "hand block", "block print", "block-printed", "artisan", "pottery", "ceramic", "terracotta", "art", "illustration", "illustrated", "handloom", "embroidered"] },
  "food & treats": { words: FOOD, not: NOT_FOOD },
  "jewellery": { words: JEWELLERY, not: ["napkin ring", "key ring", "keyring", "ring light", "bag charm", "phone charm"] },
  "personalised": { words: PERSONAL, not: NOT_PERSONAL },
  "skincare": { words: SKINCARE, not: ["ice cream", "cream biscuit", "candle"] },
  "memories": { words: ["photo", "photobook", "photo book", "frame", "album", "memory", "memories", "scrapbook", "polaroid", "keepsake", "memory box"] },
  "little luxuries": { words: ["silk", "luxury", "luxe", "cashmere", "perfume", "parfum", "scented candle", "gift set", "robe", "pyjama", "pajama", "spa", "bath salt", "eye mask", "scrunchie", "truffle", "chocolate", "body mist", "satin"], not: ["toy", "baby", "kids", "newborn"] },
  "ethnic wear": { words: ["saree", "sari", "kurta", "kurti", "dupatta", "lehenga", "blouse", "ethnic", "salwar", "anarkali", "juda", "kalamkari", "ikat", "bandhani", "chanderi", "banarasi", "jhumka"] },
  "spiritual": { words: SPIRITUAL },
  "watches": { words: ["watch", "wristwatch", "timepiece", "chronograph", "watch strap"], not: ["watch out", "smartwatch stand"] },
  "health": { words: ["health", "healthy", "immunity", "ayurvedic", "herbal", "sugar-free", "sugar free", "protein", "millet", "massage", "sleep", "posture", "organic", "superfood", "dry fruit", "nuts", "honey", "green tea", "wellness"] },
  "gaming": { words: ["gaming", "gamer", "controller", "console", "playstation", "ps5", "xbox", "nintendo", "joystick", "controller stand", "headset"] },
  "desk & office": { words: ["desk", "office", "laptop", "planner", "notebook", "pen", "organiser", "organizer", "mousepad", "mouse pad", "laptop stand", "card holder", "desk lamp", "pen stand", "work"] },
  "coffee & tea": { words: COFFEE_TEA, not: NOT_COFFEE_TEA },
  "kitchen": { words: KITCHEN, not: NOT_KITCHEN_LOOKALIKE },
  "toys & games": { words: [...TOYS, ...GAMES] },
  "art & craft": { words: ART_DIY },
  "outdoor play": { words: ["ball", "cricket", "football", "badminton", "scooter", "cycle", "bicycle", "kite", "outdoor", "sand", "frisbee", "skipping rope", "swing", "tent"] },
  "learning & puzzles": { words: ["puzzle", "jigsaw", "learning", "educational", "stem", "science", "flash card", "flashcard", "alphabet", "activity book", "workbook", "quiz", "map", "globe", "montessori"] },

  // ---- proposed labels (not shown yet), so switching labels is only a page change
  "home decor": { words: HOME },
  "fashion & sarees": { words: CLOTHES },
  "kitchen & dining": { words: KITCHEN, not: NOT_KITCHEN_LOOKALIKE },
  "art & diy": { words: ART_DIY },
  "journals & stationery": { words: STATIONERY },
  "books": { words: BOOKS, not: NOT_BOOKS },
  "beauty & fragrance": { words: [...SKINCARE, ...MAKEUP, ...FRAGRANCE], not: ["ice cream", "cream biscuit"] },
  "bags & wallets": { words: BAGS, not: ["tea bag", "teabag", "bean bag", "gift bag", "potli bag"] },
  "plants": { words: PLANTS, not: NOT_PLANTS },
  "games & puzzles": { words: GAMES },
  "tech & audio": { words: TECH },
  "sneakers": { words: ["sneaker", "shoe", "lows", "highs", "slides", "loafer", "trainers"] },
  "lego & models": { words: ["lego", "diecast", "model", "model car", "minifigure", "building set", "bricks", "scale model"] },
};

// Words in a typed-in interest ("I love F1 and frogs") that say nothing about products.
const FILLER = new Set(["and", "the", "all", "things", "thing", "stuff", "little", "lover", "lovers", "love", "loves", "for", "with", "of", "my", "her", "his", "their", "big", "fan", "fans", "anything", "everything", "into", "very", "really", "kind", "types", "type", "style", "lots", "good"]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole words, plurals included: "mug" finds "mugs", "glass" finds "glasses", "box set" finds "box sets".
const phrase = (w) => esc(w.toLowerCase()).replace(/\\ |\s+/g, "[\\s-]+") + "(?:s|es)?";
const anyOf = (list) => list.length ? new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${list.map(phrase).join("|")})(?![\\p{L}\\p{N}])`, "iu") : null;

// One matcher per interest the shopper picked or typed.
function compile(tag) {
  const key = tag.trim().toLowerCase();
  const known = INTERESTS[key];
  if (known) return { yes: anyOf(known.words), no: anyOf(known.not || []) };
  // Typed by the shopper: its meaningful words ("F1", "frogs", "pottery").
  const words = key.split(/[\s,/&+]+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((w) => w && !FILLER.has(w) && (w.length > 2 || /\d/.test(w)))
    .map((w) => w.replace(/(?:es|s)$/, (m) => (w.length > 4 ? "" : m))); // "frogs" -> "frog"
  return { yes: anyOf(words), no: null };
}

// Score a product against the shopper's interests: a hit in the name counts most, then its type
// or tags, then its description. Each interest counts once, so several interests add up.
export function interestScorer(tags) {
  const matchers = tags.map(compile).filter((m) => m.yes);
  if (!matchers.length) return null;
  return ({ title = "", type = "", tags: itemTags = [], blurb = "" }) => {
    const kind = `${type} ${itemTags.join(" ")}`;
    const fields = [[title, 3], [kind, 2], [blurb, 1]];
    let total = 0;
    for (const m of matchers) {
      // A look-alike in its name or type rules it out ("Slice of Cake" that is a planner).
      if (m.no && m.no.test(`${title} ${kind}`)) continue;
      let best = 0;
      for (const [text, weight] of fields) if (weight > best && text && m.yes.test(text)) best = weight;
      total += best;
    }
    return total;
  };
}
