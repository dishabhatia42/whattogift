// Serial Gifter: data and helpers shared by the form (/) and the results page (/ideas).
(() => {
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
  ];
  const GENDERS = [{ id: "him", t: "Him" }, { id: "her", t: "Her" }, { id: "any", t: "Either" }];
  const OCCASIONS = [
    { id: "birthday", t: "Birthday" },
    { id: "anniversary", t: "Anniversary" },
    { id: "wedding", t: "Wedding" },
    { id: "just-because", t: "Just because" },
  ];
  // A couple doesn't share a birthday; a child has no anniversary or wedding.
  const occasionsFor = (r) =>
    r === "couple" ? OCCASIONS.filter((o) => o.id !== "birthday")
    : r === "child" ? OCCASIONS.filter((o) => o.id === "birthday" || o.id === "just-because")
    : OCCASIONS;
  const BASE_INTERESTS = ["Fashion & style", "All things tech", "Books & stories", "Experiences", "Home & cosy things", "Fitness & wellness", "Food & treats", "Handmade & artsy"];
  const SUGGESTIONS = {
    default: BASE_INTERESTS,
    partner: [...BASE_INTERESTS, "Jewellery", "Personalised"],
    friend: [...BASE_INTERESTS, "Skincare", "Memories"],
    mom: [...BASE_INTERESTS, "Ethnic wear", "Spiritual"],
    dad: [...BASE_INTERESTS, "Watches", "Health"],
    parents: [...BASE_INTERESTS, "Health", "Spiritual"],
    sibling: [...BASE_INTERESTS, "Gaming", "Skincare"],
    colleague: [...BASE_INTERESTS, "Desk & office", "Coffee & tea"],
    couple: [...BASE_INTERESTS, "Kitchen", "Personalised"],
    child: ["Toys & games", "Books & stories", "Art & craft", "Outdoor play", "Learning & puzzles", "Food & treats"],
  };
  // Emojis are display-only; the plain words are what the search sees.
  const INTEREST_EMOJI = {
    "Fashion & style": "👗", "All things tech": "📱", "Books & stories": "📚", "Experiences": "🎟️",
    "Home & cosy things": "🪴", "Fitness & wellness": "🏋️", "Food & treats": "🍫", "Handmade & artsy": "🎨",
    "Jewellery": "💍", "Personalised": "✨", "Skincare": "🧴", "Memories": "📸", "Ethnic wear": "🥻",
    "Spiritual": "🪔", "Watches": "⌚", "Health": "🩺", "Gaming": "🎮", "Desk & office": "🖇️",
    "Coffee & tea": "☕", "Kitchen": "🍳", "Toys & games": "🧸", "Art & craft": "🖍️", "Outdoor play": "⚽",
    "Learning & puzzles": "🧩",
  };
  const BUDGETS = [
    { id: "under-1000", t: "Under ₹1,000" },
    { id: "1000-3000", t: "₹1,000–₹3,000" },
    { id: "3000-7000", t: "₹3,000–₹7,000" },
    { id: "7000-plus", t: "₹7,000+", note: "Going all out, huh?" },
  ];
  const STORE_NAMES = { amazon: "Amazon", myntra: "Myntra", nykaa: "Nykaa", flipkart: "Flipkart" };
  const asksGender = (r) => !!RECIPIENTS.find((x) => x.id === r)?.ask;
  const safeHref = (u) => /^https:\/\//.test(u || "") ? u : null;

  // ---- the answers <-> URL (same query string the search API and its cache use)
  function toParams(s) {
    const p = new URLSearchParams({ recipient: s.recipient, occasion: s.occasion });
    if (asksGender(s.recipient) && (s.gender === "him" || s.gender === "her")) p.set("gender", s.gender);
    if (s.budget) p.set("budget", s.budget);
    const tags = [...new Set(s.tags.map((t) => t.toLowerCase()))].sort();
    if (tags.length) p.set("tags", tags.join(","));
    return p;
  }
  // Reads answers from a URL, dropping anything that isn't a known option.
  function fromParams(p) {
    const recipient = RECIPIENTS.some((r) => r.id === p.get("recipient")) ? p.get("recipient") : null;
    const occasion = recipient && occasionsFor(recipient).some((o) => o.id === p.get("occasion")) ? p.get("occasion") : null;
    const gender = asksGender(recipient) && ["him", "her"].includes(p.get("gender")) ? p.get("gender") : null;
    const budget = BUDGETS.some((b) => b.id === p.get("budget")) ? p.get("budget") : null;
    const tags = (p.get("tags") || "").split(",").map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 8);
    return { recipient, gender, occasion, budget, tags };
  }

  function resultsTitle(s) {
    const g = s.gender === "him" || s.gender === "her" ? s.gender : null;
    const who = {
      partner: g === "him" ? "your boyfriend or husband" : g === "her" ? "your girlfriend or wife" : "your person",
      friend: "your bestie", mom: "your mom", dad: "your dad", parents: "your parents",
      sibling: g === "him" ? "your brother" : g === "her" ? "your sister" : "your sibling",
      colleague: "your work bestie", couple: "the couple",
      child: g === "him" ? "a little boy" : g === "her" ? "a little girl" : "a little human",
    }[s.recipient];
    const why = { birthday: "Birthday", anniversary: "Anniversary", wedding: "Wedding", "just-because": "" }[s.occasion];
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
  function mountFeatured(getState) {
    const $ = (id) => document.getElementById(id);
    const section = $("featured"), row = $("feat-row");
    const desktopQuery = matchMedia("(min-width: 720px) and (hover: hover)");
    const calmQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const carousel = { active: false, paused: false, timer: null };
    let lastKey = null;

    const tileStep = () => { const t = row.querySelector(".feat"); return t ? t.getBoundingClientRect().width + 12 : 0; };
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
      $("feat-count").textContent = !carousel.active && tiles > 2 ? "Swipe →" : "";
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
      for (const ad of ordered) {
        const a = document.createElement("a");
        a.className = "feat"; a.href = ad.url; a.target = "_blank"; a.rel = "sponsored noopener noreferrer";
        if (safeHref(ad.image)) {
          const img = document.createElement("img"); img.src = ad.image; img.alt = ""; img.loading = "lazy"; a.appendChild(img);
        } else {
          const ph = document.createElement("span"); ph.className = "ph"; ph.setAttribute("aria-hidden", "true"); ph.textContent = (ad.brand || "?").trim()[0].toUpperCase(); a.appendChild(ph);
        }
        const tx = document.createElement("span"); tx.className = "tx";
        const who = document.createElement("span"); who.className = "who";
        const brand = document.createElement("span"); brand.textContent = ad.brand; who.appendChild(brand);
        const tag = document.createElement("b"); tag.textContent = "Ad"; who.appendChild(tag);
        const title = document.createElement("strong"); title.textContent = ad.title;
        tx.append(who, title);
        if (ad.tagline) { const tl = document.createElement("span"); tl.className = "tl"; tl.textContent = ad.tagline; tx.appendChild(tl); }
        const go = document.createElement("span"); go.className = "go2"; go.textContent = live.length > 1 ? "Explore →" : "Explore this find →"; tx.appendChild(go);
        a.appendChild(tx); row.appendChild(a);
      }
      section.hidden = !ordered.length;
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
  // [x %, y %, size px, tilt deg]. A row across the top, then a few more down the left and
  // middle, keeping clear of the headline (bottom right) and the typewriter line (bottom left).
  const SLOTS_WIDE = [
    [4, 6, 128, -8], [21, 4, 112, 6], [39, 6, 120, 9], [57, 4, 132, -4], [75, 8, 116, 7],
    [94, 5, 104, -9], [5, 40, 112, 5], [22, 48, 100, -6], [38, 30, 96, 4], [74, 27, 92, 10],
  ];
  const SLOTS_NARROW = [
    [4, 6, 88, -8], [40, 2, 80, 6], [76, 8, 86, 9], [14, 52, 82, 5], [50, 46, 90, -6], [84, 54, 76, -10],
  ];
  const FILLERS = ["🎁", "🧸", "💐", "🍫", "📚", "🕯️", "🎀", "☕", "🪴", "💌"];
  // Decides how a product photo sits on the board, all in the browser (free, no AI):
  //   "cut"   the photo has a plain light backdrop (white, grey, cream): it's removed, leaving a
  //           cutout with a die-cut sticker edge. src is a PNG data URL.
  //   "flat"  the backdrop is plain but removing it would shred the item (a book cover or poster
  //           whose own background matches): the photo is the object, shown as-is.
  //   "photo" a busy or lifestyle photo (or the store won't let us read it): shown as a round sticker.
  const cutouts = new Map();
  function cutout(url) {
    if (!cutouts.has(url)) cutouts.set(url, new Promise((done) => {
      const photo = () => done({ kind: "photo" });
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onerror = photo;
      im.onload = () => {
        try {
          const S = 320, k = Math.min(S / im.naturalWidth, S / im.naturalHeight);
          const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(im, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h), px = data.data;
          const edge = [];
          for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
          for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
          // Already a cutout (see-through PNG/WebP): use it as is.
          if (edge.filter((p) => px[p * 4 + 3] < 16).length > edge.length * 0.6) return done({ kind: "cut", src: url });
          // The backdrop colour is the typical edge colour; it must be light and the edges even.
          const med = [0, 1, 2].map((ch) => { const v = edge.map((p) => px[p * 4 + ch]).sort((m, n) => m - n); return v[v.length >> 1]; });
          const near = (i, tol) => Math.abs(px[i] - med[0]) < tol && Math.abs(px[i + 1] - med[1]) < tol && Math.abs(px[i + 2] - med[2]) < tol;
          const light = 0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2];
          if (light < 175 || edge.filter((p) => near(p * 4, 26)).length < edge.length * 0.85) return photo();
          // Flood in from the edges, so backdrop-coloured parts inside the product stay put.
          const bg = (i) => near(i, 30);
          const seen = new Uint8Array(w * h), stack = edge.filter((p) => bg(p * 4));
          let removed = 0;
          while (stack.length) {
            const p = stack.pop();
            if (seen[p]) continue;
            seen[p] = 1; px[p * 4 + 3] = 0; removed++;
            const x = p % w, y = (p - x) / w;
            for (const q of [x > 0 && p - 1, x < w - 1 && p + 1, y > 0 && p - w, y < h - 1 && p + w]) if (q !== false && !seen[q] && bg(q * 4)) stack.push(q);
          }
          if (removed > w * h * 0.97) return photo();          // nothing left
          if (removed < w * h * 0.08) return done({ kind: "flat" }); // the item fills the frame
          // What's left must be one solid object, not scattered bits (like the lettering on a cover
          // whose background got removed): it should fill a good share of its own bounding box.
          let x0 = w, y0 = h, x1 = 0, y1 = 0;
          for (let p = 0; p < w * h; p++) if (!seen[p]) { const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          if ((w * h - removed) / ((x1 - x0 + 1) * (y1 - y0 + 1)) < 0.5) return done({ kind: "flat" });
          // Soften the edge: pixels touching the removed area fade a little.
          for (let p = 0; p < w * h; p++) {
            if (seen[p]) continue;
            const x = p % w;
            if ((x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || seen[p - w] || seen[p + w]) px[p * 4 + 3] = 150;
          }
          ctx.putImageData(data, 0, 0);
          done({ kind: "cut", src: c.toDataURL("image/png") });
        } catch { photo(); } // the store didn't allow reading the photo
      };
      im.src = url;
    }));
    return cutouts.get(url);
  }

  function mountBoard() {
    const box = document.getElementById("stickers");
    if (!box) return;
    const wide = matchMedia("(min-width: 720px)");
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    function draw() {
      const slots = wide.matches ? SLOTS_WIDE : SLOTS_NARROW;
      const items = catalog.board.filter((p) => safeHref(p.url)).slice(0, slots.length);
      box.textContent = "";
      slots.forEach(([x, y, size, tilt], i) => {
        const product = items[i];
        const el = document.createElement("span");
        // Tags on edge stickers line up inward so they never run off the screen.
        el.className = "sticker " + (product ? "real" : "filler") + (x < 30 ? " cap-left" : x > 70 ? " cap-right" : "");
        // Keep every sticker inside the board: the left edge moves in by its own width as x grows.
        el.style.cssText = `left:calc(${x}% - ${Math.round(size * x / 100)}px);top:${y}%;--size:${size}px;--tilt:${tilt}deg;--d:${i * 60}ms;--drift:${(i % 3) - 1}`;
        if (product) {
          const link = (cls) => { const a = document.createElement("a"); a.className = cls; a.href = product.url; a.target = "_blank"; a.rel = "noopener noreferrer"; return a; };
          const photo = link("photo");
          photo.setAttribute("aria-label", product.name);
          if (safeHref(product.image)) {
            // Hidden until we know how to show it, so a square never flashes up first.
            const img = document.createElement("img"); img.alt = ""; photo.appendChild(img);
            el.classList.add("loading");
            cutout(product.image).then(({ kind, src }) => {
              img.onload = () => { el.classList.remove("loading"); keepClear(); };
              img.onerror = () => el.classList.remove("loading");
              img.src = src || product.image; el.classList.add(kind);
            });
          } else { const t = document.createElement("span"); t.className = "noimg"; t.textContent = product.name; photo.appendChild(t); }
          // Instagram-style tag with the name (and Disha's line) that goes straight to the product.
          // It appears on hover; on touch screens it is always shown.
          const tag = link("tag");
          tag.title = product.name;
          const n = document.createElement("span"); n.className = "tname"; n.textContent = product.name;
          const arr = document.createElement("span"); arr.className = "tarr"; arr.setAttribute("aria-hidden", "true"); arr.textContent = "↗";
          tag.append(n, arr);
          if (product.line) { const l = document.createElement("span"); l.className = "tline"; l.textContent = product.line; tag.appendChild(l); }
          el.append(photo, tag);
          // On touch screens the first tap on the photo shows Disha's line, the second opens the product.
          photo.addEventListener("click", (e) => {
            if (matchMedia("(hover: hover)").matches || el.classList.contains("open") || !product.line) return;
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
    wide.addEventListener("change", draw);
    draw();
    catalogReady.then(draw);
  }

  // Header gets a soft line and shadow once the page scrolls.
  const header = document.getElementById("site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 4);
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  window.WTG = {
    RECIPIENTS, GENDERS, OCCASIONS, occasionsFor, SUGGESTIONS, INTEREST_EMOJI, BUDGETS, STORE_NAMES,
    asksGender, safeHref, toParams, fromParams, resultsTitle,
    catalog, catalogReady, pickAds, mountFeatured, mountBoard,
  };
})();
