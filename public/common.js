// Serial Gifter: data and helpers shared by the form (/) and the results page (/ideas).
(() => {
  // ---- Site details, in one place: the footer, the legal page and the ad invitations all read these.
  const SITE = {
    email: ["dishabhatia42", "gmail.com"].join("@"), // put together here so simple spam bots reading the HTML don't see it
    legal: "/legal",
    year: 2026,
    amazonDisclosure: "As an Amazon Associate I earn from qualifying purchases.", // Amazon's exact wording: don't change
  };

  // Who: relationships only. Gender is a separate, optional follow-up where it matters.
  const RECIPIENTS = [
    { id: "partner", e: "❤️", t: "My person", ask: true },
    { id: "friend", e: "🫶", t: "Bestie", ask: true },
    { id: "mom", e: "💐", t: "Mom" },
    { id: "dad", e: "🧢", t: "Dad" },
    { id: "parents", e: "🏡", t: "Parents" },
    { id: "sibling", e: "😈", t: "Sibling", ask: true },
    { id: "colleague", e: "💻", t: "Work bestie", ask: true },
    { id: "couple", e: "🥂", t: "A couple" },
    { id: "child", e: "🧸", t: "Little human", ask: true },
    { id: "self", e: "✨", t: "Me, myself", ask: true },
  ];
  const GENDERS = [{ id: "him", t: "Him" }, { id: "her", t: "Her" }, { id: "any", t: "Either" }];
  const OCCASIONS = [
    { id: "birthday", t: "Birthday" },
    { id: "anniversary", t: "Anniversary" },
    { id: "wedding", t: "Wedding" },
    { id: "just-because", t: "Just because" },
    { id: "win", t: "A win to celebrate" },
  ];
  // A couple doesn't share a birthday; a child has no anniversary or wedding. A treat for yourself
  // is a birthday, a win or just because (and "a win" is only offered there, for now).
  const only = (...ids) => ids.map((id) => OCCASIONS.find((o) => o.id === id));
  const occasionsFor = (r) =>
    r === "self" ? only("birthday", "win", "just-because")
    : r === "couple" ? only("anniversary", "wedding", "just-because")
    : r === "child" ? only("birthday", "just-because")
    : only("birthday", "anniversary", "wedding", "just-because");
  // What the brands in the catalogue actually sell most (see api/_lib/vocabulary.js for what each
  // one matches). Ordered long + short in pairs, so on a phone two always share a line.
  // "Experiences" mostly brings experience ideas (classes, tastings, outings) that link to a web search.
  const BASE_INTERESTS = ["Journals & stationery", "Books", "Kitchen & dining", "Jewellery", "Fashion & sarees", "Coffee & tea", "Beauty & fragrance", "Art & DIY", "Food & treats", "Home decor", "Experiences"];
  const SUGGESTIONS = {
    default: BASE_INTERESTS,
    partner: [...BASE_INTERESTS, "Bags & wallets", "Little luxuries"],
    friend: [...BASE_INTERESTS, "Games & puzzles", "Bags & wallets"],
    self: [...BASE_INTERESTS, "Little luxuries", "Plants"],
    mom: [...BASE_INTERESTS, "Plants", "Spiritual"],
    dad: [...BASE_INTERESTS, "Tech & audio", "Games & puzzles"],
    parents: [...BASE_INTERESTS, "Plants", "Spiritual"],
    sibling: [...BASE_INTERESTS, "Games & puzzles", "Sneakers"],
    colleague: [...BASE_INTERESTS, "Desk & office", "Bags & wallets"],
    couple: [...BASE_INTERESTS, "Games & puzzles", "Plants"],
    child: ["Toys & games", "Books", "LEGO & models", "Art & DIY", "Learning & puzzles", "Food & treats"],
  };
  // Emojis are display-only; the plain words are what the search sees.
  const INTEREST_EMOJI = {
    "Journals & stationery": "📓", "Books": "📚", "Kitchen & dining": "🍳", "Jewellery": "💍", "Fashion & sarees": "👗",
    "Coffee & tea": "☕", "Beauty & fragrance": "💄", "Art & DIY": "🎨", "Food & treats": "🍫", "Home decor": "🛋️",
    "Bags & wallets": "👜", "Little luxuries": "🛁", "Games & puzzles": "🎲", "Plants": "🪴", "Spiritual": "🪔",
    "Tech & audio": "🎧", "Sneakers": "👟", "Desk & office": "🖇️", "Toys & games": "🧸", "LEGO & models": "🧱",
    "Learning & puzzles": "🧩", "Experiences": "🎟️",
  };
  const BUDGETS = [
    { id: "under-1000", t: "Under ₹1,000" },
    { id: "1000-3000", t: "₹1,000–₹3,000" },
    { id: "3000-7000", t: "₹3,000–₹7,000" },
    { id: "7000-plus", t: "₹7,000+", note: "Going all out, huh?" },
  ];
  // Results-page refinements ("Not quite their vibe?"). The ids are the API's whitelist too.
  const TUNES = [
    { id: "unusual", t: "More unusual" },
    { id: "personal", t: "More personal" },
    { id: "practical", t: "More practical" },
    { id: "cheaper", t: "Less expensive" },
    { id: "experiences", t: "More experiences" },
    { id: "noclutter", t: "No clutter" },
  ];
  const STORE_NAMES = { amazon: "Amazon", myntra: "Myntra", nykaa: "Nykaa", flipkart: "Flipkart", web: "Google" };
  const asksGender = (r) => !!RECIPIENTS.find((x) => x.id === r)?.ask;
  const safeHref = (u) => /^https:\/\//.test(u || "") ? u : null;

  // ---- the answers <-> URL (same query string the search API and its cache use)
  function toParams(s) {
    const p = new URLSearchParams({ recipient: s.recipient, occasion: s.occasion });
    if (asksGender(s.recipient) && (s.gender === "him" || s.gender === "her")) p.set("gender", s.gender);
    if (s.budget) p.set("budget", s.budget);
    const tags = [...new Set(s.tags.map((t) => t.toLowerCase()))].sort();
    if (tags.length) p.set("tags", tags.join(","));
    if (s.discover) p.set("new", "1");
    const tune = TUNES.filter((t) => (s.tune || []).includes(t.id)).map((t) => t.id);
    if (tune.length) p.set("tune", tune.join(","));
    return p;
  }
  // Interests are typed freely and travel in shareable links, so rude words and "ignore the
  // rules…" tricks are dropped here (and again on the server: api/_lib/interests.js; keep in sync).
  const BLOCKED = new RegExp(
    "\\b(" + [
      "fuck\\w*", "shit\\w*", "bitch\\w*", "bastards?", "cunts?", "dicks?", "cocks?", "pussy", "whores?", "sluts?",
      "rap(e|es|ed|ist|ists)", "porn\\w*", "nudes?", "naked", "sex\\w*", "nazis?", "hitler", "kill(ing|er|s)?", "murder\\w*",
      "suicide", "terroris\\w*", "bombs?", "guns?", "drugs?", "cocaine", "heroin",
      "nigg\\w*", "fag\\w*", "retard\\w*",
      "chutiy\\w*", "madarchod\\w*", "bh?e+n+chod\\w*", "behenchod\\w*", "bhosd\\w*", "bsdk", "gandu", "randi", "lund", "chut",
    ].join("|") + ")\\b",
    "i",
  );
  
  // Looks like an instruction to the AI rather than an interest.
  const INSTRUCTION = /\b(ignore|disregard|forget|override)\b|\b(instructions?|prompts?|system prompt|jailbreak|roleplay|pretend)\b|\b(act as|you are|write (a|an|me)|tell me|repeat after)\b|https?:|www\.|\.(com|in|net|org)\b/i;
  
  // Plain words only: letters (any language), digits, spaces and a little punctuation.
  const ALLOWED_CHARS = /^[\p{L}\p{M}\p{N} &'’.,+\-/]+$/u;
  function cleanInterests(list) {
    return (Array.isArray(list) ? list : [])
      .filter((t) => typeof t === "string")
      .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 30))
      .filter((t) => t && ALLOWED_CHARS.test(t) && t.split(" ").length <= 5 && !BLOCKED.test(t) && !INSTRUCTION.test(t))
      .slice(0, 8);
  }

  // Reads answers from a URL, dropping anything that isn't a known option.
  function fromParams(p) {
    const recipient = RECIPIENTS.some((r) => r.id === p.get("recipient")) ? p.get("recipient") : null;
    const occasion = recipient && occasionsFor(recipient).some((o) => o.id === p.get("occasion")) ? p.get("occasion") : null;
    const gender = asksGender(recipient) && ["him", "her"].includes(p.get("gender")) ? p.get("gender") : null;
    const budget = BUDGETS.some((b) => b.id === p.get("budget")) ? p.get("budget") : null;
    const tags = cleanInterests((p.get("tags") || "").split(","));
    const discover = p.get("new") === "1";
    const tune = (p.get("tune") || "").split(",").filter((t) => TUNES.some((x) => x.id === t));
    return { recipient, gender, occasion, budget, tags, discover, tune };
  }

  function resultsTitle(s) {
    const g = s.gender === "him" || s.gender === "her" ? s.gender : null;
    const who = {
      partner: g === "him" ? "your boyfriend or husband" : g === "her" ? "your girlfriend or wife" : "your person",
      friend: "your bestie", mom: "your mom", dad: "your dad", parents: "your parents",
      sibling: g === "him" ? "your brother" : g === "her" ? "your sister" : "your sibling",
      colleague: "your work bestie", couple: "the couple",
      child: g === "him" ? "a little boy" : g === "her" ? "a little girl" : "a little human",
      self: "you",
    }[s.recipient];
    const why = { birthday: "Birthday", anniversary: "Anniversary", wedding: "Wedding", win: "Celebration", "just-because": "" }[s.occasion];
    return why ? `${why} ideas for ${who}` : `Ideas for ${who}, just because`;
  }

  // ---- ads (and the version stamp that refreshes cached searches after admin changes)
  const catalog = { ads: [], board: [], version: "" };
  const catalogReady = fetch("/api/catalog").then((r) => r.ok ? r.json() : null).then((d) => {
    if (d && Array.isArray(d.ads)) catalog.ads = d.ads;
    if (d && Array.isArray(d.board)) catalog.board = d.board;
    if (d && d.version) catalog.version = d.version;
  }).catch(() => {});

  // An ad with nothing ticked for a field matches everything for that field.
  const matches = (item, s) =>
    (!item.recipients.length || item.recipients.includes(s.recipient)) &&
    (!item.occasions.length || item.occasions.includes(s.occasion));

  // Up to two matching ads per search, shuffled so every slot gets seen.
  function pickAds(s) {
    const pool = catalog.ads.filter((a) => matches(a, s) && safeHref(a.url));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 2);
  }

  // ---- "Featured" strip: every live ad, ones matching the current answers first.
  // On desktop with more than 3 ads it auto-advances every 5 s (pauses on hover/focus/hidden tab,
  // never for reduced motion or on touch screens).
  // The picture or video inside an ad tile. Videos play muted on a loop (not for reduced motion).
  function adMedia(ad) {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (safeHref(ad.video)) {
      const v = document.createElement("video");
      v.src = ad.video; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !calm; v.preload = "metadata";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
      if (safeHref(ad.image)) v.poster = ad.image;
      return v;
    }
    if (safeHref(ad.image)) { const img = document.createElement("img"); img.src = ad.image; img.alt = ""; img.loading = "lazy"; return img; }
    const ph = document.createElement("span"); ph.className = "ph"; ph.setAttribute("aria-hidden", "true"); ph.textContent = (ad.brand || "?").trim()[0].toUpperCase();
    return ph;
  }

  const AD_SLOT_COUNT = 5; // matches AD_SLOTS in api/_lib/store.js
  function mountFeatured(getState) {
    const $ = (id) => document.getElementById(id);
    const section = $("featured"), row = $("feat-row");
    const desktopQuery = matchMedia("(min-width: 720px) and (hover: hover)");
    const calmQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const carousel = { active: false, paused: false, timer: null };
    let lastKey = null;

    const tileStep = () => { const t = row.querySelector(".feat"); return t ? t.getBoundingClientRect().width + 14 : 0; };
    // "At the end" once under 24 px is left to reveal: the last ad is fully shown, but no tiny nudge before wrapping.
    const atEnd = () => row.scrollLeft + row.clientWidth >= row.scrollWidth - 24;
    function step(dir) {
      if (dir > 0 && atEnd()) row.scrollTo({ left: 0, behavior: "smooth" });
      else if (dir < 0 && row.scrollLeft <= 4) row.scrollTo({ left: row.scrollWidth, behavior: "smooth" });
      else row.scrollBy({ left: dir * tileStep(), behavior: "smooth" });
    }
    function restartTimer() {
      clearInterval(carousel.timer);
      carousel.timer = carousel.active ? setInterval(() => { if (!carousel.paused && !document.hidden) step(1); }, 5000) : null;
    }
    function updateDots() {
      const dots = [...$("feat-dots").children];
      const atLast = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      const i = atLast ? dots.length - 1 : Math.round(row.scrollLeft / (tileStep() || 1));
      dots.forEach((d, n) => d.setAttribute("aria-current", String(n === i)));
    }
    function setupCarousel() {
      const tiles = row.querySelectorAll(".feat").length;
      // Measure instead of assuming: it only moves when some ads are actually out of view.
      const overflow = row.scrollWidth - row.clientWidth;
      carousel.active = desktopQuery.matches && !calmQuery.matches && tiles > 1 && overflow > 8;
      section.classList.toggle("auto", carousel.active);
      const dots = $("feat-dots"); dots.textContent = "";
      if (carousel.active) {
        const stops = Math.ceil((overflow - 4) / tileStep()) + 1; // positions where the strip can rest
        for (let n = 0; n < stops; n++) {
          const d = document.createElement("button"); d.type = "button"; d.setAttribute("aria-label", `Show ad ${n + 1}`);
          d.addEventListener("click", () => { row.scrollTo({ left: Math.min(n * tileStep(), overflow), behavior: "smooth" }); restartTimer(); });
          dots.appendChild(d);
        }
      }
      $("feat-count").textContent = !carousel.active && overflow > 8 ? "Swipe →" : ""; // only when there's more to see
      row.scrollLeft = 0;
      updateDots();
      restartTimer();
    }

    function render(force) {
      const s = getState();
      const key = `${catalog.ads.length}|${s.recipient}|${s.occasion}`;
      if (key === lastKey && !force) return; // avoid rebuilding (and losing the swipe position) on every tap
      lastKey = key;
      const live = catalog.ads.filter((a) => safeHref(a.url));
      const ordered = s.recipient ? [...live.filter((a) => matches(a, s)), ...live.filter((a) => !matches(a, s))] : live;
      row.textContent = "";
      // Each ad is a tall picture (or a muted looping video) with just the brand and category below.
      for (const ad of ordered) {
        const a = document.createElement("a");
        a.className = "feat"; a.href = ad.url; a.target = "_blank"; a.rel = "sponsored noopener noreferrer";
        track(a, "Ad click", { brand: ad.brand, slot: ad.slot, where: "home" });
        a.setAttribute("aria-label", `${ad.brand}${ad.category ? ", " + ad.category : ""} (ad)`);
        const box = document.createElement("span"); box.className = "box";
        box.appendChild(adMedia(ad));
        const tag = document.createElement("b"); tag.className = "ad"; tag.textContent = "Sponsored"; box.appendChild(tag);
        // The whole tile is the link; the arrow just makes that obvious.
        const go = document.createElement("span"); go.className = "go-arrow"; go.setAttribute("aria-hidden", "true"); go.textContent = "↗"; box.appendChild(go);
        const name = document.createElement("span"); name.className = "nm"; name.textContent = ad.brand;
        a.append(box, name);
        if (ad.category) { const cat = document.createElement("span"); cat.className = "cat"; cat.textContent = ad.category; a.appendChild(cat); }
        row.appendChild(a);
      }
      // Empty ad slots invite brands in. The pitch is said once, on the first open spot, with how many
      // are left; the rest are quiet empty frames that show the space is free. Every one opens an
      // email to Disha. They turn into real ads as slots fill.
      // (The address is put together here, in the page, so simple spam bots reading the HTML don't see it.)
      const mail = SITE.email;
      const subject = encodeURIComponent("Featuring my brand on Serial Gifter");
      const body = encodeURIComponent("Hi Disha,\n\nI'd love to feature my brand on Serial Gifter.\n\nBrand:\nWebsite / Instagram:\nCategory:\n\nThanks!");
      const open = AD_SLOT_COUNT - ordered.length;
      for (let n = 0; n < open; n++) {
        const pitch = n === 0;
        const a = document.createElement("a");
        a.className = "feat open-slot" + (pitch ? "" : " quiet"); a.href = `mailto:${mail}?subject=${subject}&body=${body}`;
        track(a, "Get featured click", { tile: pitch ? "pitch" : "open spot" });
        a.setAttribute("aria-label", pitch
          ? `Your brand here: ${open} of ${AD_SLOT_COUNT} spots open. Write to me to get featured.`
          : "Open spot. Write to me to feature your brand here.");
        const box = document.createElement("span"); box.className = "box";
        const inner = document.createElement("span"); inner.className = "slot-msg";
        if (pitch) {
          const big = document.createElement("strong"); big.textContent = "Your brand here";
          const left = document.createElement("span"); left.textContent = `${open} of ${AD_SLOT_COUNT} spots open`;
          inner.append("✨", big, left);
          const go = document.createElement("span"); go.className = "go-arrow"; go.setAttribute("aria-hidden", "true"); go.textContent = "↗"; box.appendChild(go);
        } else {
          const plus = document.createElement("span"); plus.className = "plus"; plus.setAttribute("aria-hidden", "true"); plus.textContent = "+";
          inner.append(plus);
        }
        box.prepend(inner);
        const name = document.createElement("span"); name.className = "nm" + (pitch ? " wrap" : ""); name.textContent = pitch ? "Get featured" : "Open spot";
        a.append(box, name);
        if (pitch) { const cat = document.createElement("span"); cat.className = "cat write"; cat.textContent = "Write to me →"; a.appendChild(cat); }
        row.appendChild(a);
      }
      section.hidden = false;
      setupCarousel();
    }

    $("feat-prev").addEventListener("click", () => { step(-1); restartTimer(); });
    $("feat-next").addEventListener("click", () => { step(1); restartTimer(); });
    row.addEventListener("scroll", updateDots, { passive: true });
    section.addEventListener("mouseenter", () => { carousel.paused = true; });
    section.addEventListener("mouseleave", () => { carousel.paused = false; });
    section.addEventListener("focusin", () => { carousel.paused = true; });
    section.addEventListener("focusout", () => { carousel.paused = false; });
    desktopQuery.addEventListener("change", () => render(true));
    calmQuery.addEventListener("change", () => render(true));
    catalogReady.then(() => render(true));
    return render;
  }

  // ---- the home-page board: pinned products as tilted stickers, topped up with emoji stickers
  // so it never looks empty. Positions are hand-placed slots (x %, y %, size px, tilt deg).
  // Wide: the right half stays above ~45% so the headline (bottom-right) is never covered.
  // [x %, y %, size px, tilt deg]. Seven across the top, three down the left and middle, evenly
  // spaced and clear of the headline (bottom right) and the typewriter line (bottom left).
  const SLOTS_WIDE = [
    [3, 6, 116, -7], [19, 12, 104, 5], [35, 5, 112, -4], [51, 11, 104, 6], [67, 5, 112, -5],
    [83, 12, 100, 7], [98, 5, 104, -6], [5, 40, 104, 5], [22, 48, 94, -6], [39, 34, 96, 4],
  ];
  // Phone: six bigger stickers, two staggered rows of three.
  const SLOTS_NARROW = [
    [5, 3, 96, -7], [50, 0, 92, 5], [95, 5, 96, -6],
    [8, 52, 92, 6], [50, 48, 96, -5], [92, 53, 92, 8],
  ];
  const FILLERS = ["🎁", "🧸", "💐", "🍫", "📚", "🕯️", "🎀", "☕", "🪴", "💌"];
  function mountBoard() {
    const box = document.getElementById("stickers");
    if (!box) return;
    const wide = matchMedia("(min-width: 720px)");
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    function draw() {
      const slots = wide.matches ? SLOTS_WIDE : SLOTS_NARROW;
      const live = catalog.board.filter((p) => safeHref(p.url));
      // Phones have room for six: the ones Disha ticked "Also show it on phones" first, then the rest in order.
      const items = (wide.matches ? live : [...live.filter((p) => p.phone), ...live.filter((p) => !p.phone)]).slice(0, slots.length);
      box.textContent = "";
      slots.forEach(([x, y, size, tilt], i) => {
        const product = items[i];
        const el = document.createElement("span");
        // Tags on edge stickers line up inward so they never run off the screen.
        el.className = "sticker " + (product ? "real" : "filler") + (x < 30 ? " cap-left" : x > 70 ? " cap-right" : "");
        // Keep every sticker inside the board: the left edge moves in by its own width as x grows.
        el.style.cssText = `left:calc(${x}% - ${Math.round(size * x / 100)}px);top:${y}%;--size:${size}px;--tilt:${tilt}deg;--d:${i * 60}ms;--drift:${(i % 3) - 1}`;
        if (product) {
          const link = (cls) => { const a = document.createElement("a"); a.className = cls; a.href = product.url; a.target = "_blank"; a.rel = "noopener noreferrer"; return track(a, "Board click", { product: product.name, device: wide.matches ? "desktop" : "phone" }); };
          const photo = link("photo");
          photo.setAttribute("aria-label", product.name);
          if (safeHref(product.image)) {
            // Hidden until we know how to show it, so a square never flashes up first.
            const img = document.createElement("img"); img.alt = ""; photo.appendChild(img);
            el.classList.add("loading");
            // Every product is the same rounded-square card (photos with a see-through background
            // sit on white inside it), so the board looks like one consistent set.
            img.onload = () => { el.classList.remove("loading"); keepClear(); };
            img.onerror = () => el.classList.remove("loading");
            img.src = product.image; el.classList.add("photo");
          } else { const t = document.createElement("span"); t.className = "noimg"; t.textContent = product.name; photo.appendChild(t); }
          // Instagram-style tag with the name (and Disha's line) that goes straight to the product.
          // It appears on hover; on touch screens it is always shown.
          const tag = link("tag");
          tag.title = product.name;
          const n = document.createElement("span"); n.className = "tname"; n.textContent = product.name;
          const arr = document.createElement("span"); arr.className = "tarr"; arr.setAttribute("aria-hidden", "true"); arr.textContent = "↗";
          tag.append(n, arr);
          if (product.line) { const l = document.createElement("span"); l.className = "tline"; l.textContent = product.line; tag.appendChild(l); }
          if (product.affiliate) { const af = document.createElement("span"); af.className = "taff"; af.textContent = "Affiliate link"; tag.appendChild(af); }
          el.append(photo, tag);
          // On touch screens the first tap on the photo shows its tag (name, and Disha's line if any);
          // tapping the tag, or the photo again, opens the product.
          photo.addEventListener("click", (e) => {
            if (matchMedia("(hover: hover)").matches || el.classList.contains("open")) return;
            e.preventDefault();
            box.querySelectorAll(".open").forEach((o) => o.classList.remove("open"));
            el.classList.add("open");
          });
        } else {
          el.setAttribute("aria-hidden", "true");
          el.textContent = FILLERS[i % FILLERS.length];
        }
        box.appendChild(el);
      });
      keepClear();
    }
    // Never let a sticker sit on the words: shrink one that touches the headline, lede or
    // typewriter line, and hide it if it still does (only happens on short or narrow screens).
    const words = () => [...document.querySelectorAll(".board-copy h1, .board-copy .lede, .board-copy .type")].map((n) => n.getBoundingClientRect());
    function keepClear() {
      const zones = words();
      const hits = (r) => zones.some((z) => r.left < z.right + 8 && r.right > z.left - 8 && r.top < z.bottom + 8 && r.bottom > z.top - 8);
      for (const el of box.children) {
        el.style.removeProperty("--fit"); el.classList.remove("hide");
        for (const fit of [0.8, 0.64]) {
          if (!hits(el.getBoundingClientRect())) break;
          el.style.setProperty("--fit", fit);
        }
        if (hits(el.getBoundingClientRect())) el.classList.add("hide");
      }
    }
    let resizeTimer;
    addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(keepClear, 150); });
    // Gentle drift while scrolling, desktop only.
    let ticking = false;
    addEventListener("scroll", () => {
      if (ticking || !wide.matches || calm.matches) return;
      ticking = true;
      requestAnimationFrame(() => { box.style.setProperty("--scroll", Math.min(scrollY, 600)); ticking = false; });
    }, { passive: true });
    document.addEventListener("click", (e) => { if (!e.target.closest(".sticker")) box.querySelectorAll(".open").forEach((o) => o.classList.remove("open")); });
    // Draw only once the products have arrived. Drawing straight away showed the emoji
    // placeholders for a moment on every load before the real products replaced them.
    catalogReady.then(() => { draw(); wide.addEventListener("change", draw); });
  }

  // Header gets a soft line and shadow once the page scrolls.
  const header = document.getElementById("site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 4);
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  // Hovering the logo sets off a tiny party popper: a 🎉 pops out at the end of "serialgifter"
  // with a burst of confetti in the brand colours, then everything fades away.
  const logo = document.querySelector(".logo");
  if (logo && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const COLORS = ["#A1354A", "#D8A928", "#E7B8C1", "#A1354A", "#D8A928", "#E7B8C1"];
    let popping = false;
    const pop = () => {
      if (popping) return;
      popping = true;
      const burst = document.createElement("span");
      burst.className = "pop"; burst.setAttribute("aria-hidden", "true");
      const popper = document.createElement("span"); popper.className = "popper"; popper.textContent = "🎉";
      burst.appendChild(popper);
      for (let i = 0; i < 14; i++) {
        // Fan out up-right to right, out of the popper's mouth (straight up would leave the screen).
        const angle = (-75 + (i / 13) * 95 + (Math.random() * 12 - 6)) * Math.PI / 180;
        const dist = 24 + Math.random() * 26;
        const bit = document.createElement("i");
        if (i % 3 === 0) bit.className = "dot";
        bit.style.cssText = `--c:${COLORS[i % COLORS.length]};--dx:${(Math.cos(angle) * dist).toFixed(1)}px;--dy:${(Math.sin(angle) * dist).toFixed(1)}px;--r:${Math.round(Math.random() * 540 - 270)}deg;--delay:${Math.round(Math.random() * 60) + 80}ms`;
        burst.appendChild(bit);
      }
      logo.appendChild(burst);
      setTimeout(() => { burst.remove(); popping = false; }, 1200);
    };
    logo.addEventListener("mouseenter", pop);
    logo.addEventListener("focus", pop);
  }

  // ---- The footer, the same on every page: tagline, Terms & Privacy, email, the affiliate
  // disclosures (Amazon's own words, kept readable, never hidden) and the copyright line.
  function mountFooter() {
    const f = document.getElementById("site-footer");
    if (!f) return;
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    f.textContent = "";
    const top = mk("div", "foot-top");
    const brand = mk("div", "foot-brand");
    brand.append(mk("span", "foot-mark", "serialgifter"), mk("span", "foot-tag", "Picked with thought, powered by a little magic (and a lot of clever tech)."));
    const nav = mk("nav", "foot-nav"); nav.setAttribute("aria-label", "Footer");
    const legal = mk("a", "", "Terms & Privacy"); legal.href = SITE.legal;
    const mail = mk("a", "", "Email us"); mail.href = `mailto:${SITE.email}`;
    nav.append(legal, mail);
    top.append(brand, nav);
    const disc = mk("p", "foot-disclosure");
    disc.append("Some links may earn us a commission at no extra cost to you. ", mk("span", "", SITE.amazonDisclosure));
    f.append(top, disc, mk("p", "foot-copy", `© ${SITE.year} Serial Gifter`));
  }
  mountFooter();
  // Any link marked data-site-email (e.g. on the legal page) becomes the contact email.
  document.querySelectorAll("a[data-site-email]").forEach((a) => { a.href = `mailto:${SITE.email}`; a.textContent = SITE.email; });

  // Click tracking (Umami): marks an element so a click on it is counted as `name`, with details.
  // Umami reads these attributes itself; values are kept short and plain.
  function track(el, name, details = {}) {
    el.setAttribute("data-umami-event", name);
    for (const [k, v] of Object.entries(details)) {
      if (v !== undefined && v !== null && v !== "") el.setAttribute(`data-umami-event-${k}`, String(v).slice(0, 80));
    }
    return el;
  }

  window.WTG = {
    RECIPIENTS, GENDERS, OCCASIONS, occasionsFor, SUGGESTIONS, INTEREST_EMOJI, BUDGETS, STORE_NAMES, TUNES,
    asksGender, safeHref, toParams, fromParams, resultsTitle, cleanInterests,
    catalog, catalogReady, pickAds, mountFeatured, mountBoard, adMedia, track, SITE,
  };
})();
