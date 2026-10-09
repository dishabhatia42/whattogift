// Thoughtful Gifting: data and helpers shared by the form (/) and the results page (/ideas).
(() => {
  // Who: relationships only. Gender is a separate, optional follow-up where it matters.
  const RECIPIENTS = [
    { id: "partner", t: "Partner", ask: true },
    { id: "friend", t: "Friend", ask: true },
    { id: "mom", t: "Mom" },
    { id: "dad", t: "Dad" },
    { id: "parents", t: "Parents" },
    { id: "sibling", t: "Sibling", ask: true },
    { id: "colleague", t: "Colleague", ask: true },
    { id: "couple", t: "A couple" },
    { id: "child", t: "A child", ask: true },
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
  const SUGGESTIONS = {
    default: ["Clothes", "Tech", "Books", "Experiences", "Home decor", "Fitness", "Food", "Handmade"],
    partner: ["Clothes", "Tech", "Jewellery", "Experiences", "Grooming", "Skincare", "Gaming", "Personalised"],
    friend: ["Clothes", "Skincare", "Books", "Memories", "Experiences", "Tech", "Snacks"],
    mom: ["Saree & ethnic wear", "Skincare", "Kitchen", "Jewellery", "Health", "Spiritual", "Plants"],
    dad: ["Tech he'll use", "Grooming", "Health", "Watches", "Books", "Travel", "Comfort"],
    parents: ["Health", "Comfort", "Tech they'll use", "Spiritual", "Home", "Travel", "Gardening"],
    sibling: ["Clothes", "Tech", "Gaming", "Skincare", "Books", "Fitness", "Snacks"],
    colleague: ["Desk & office", "Coffee & tea", "Books", "Stationery", "Plants", "Snacks"],
    couple: ["Kitchen", "Home decor", "Personalised", "Dinnerware", "Experiences", "Travel"],
    child: ["Toys", "Books", "Art & craft", "Games", "Outdoor play", "Learning"],
  };
  const BUDGETS = [
    { id: "under-1000", t: "Under ₹1k" },
    { id: "1000-3000", t: "₹1k – 3k" },
    { id: "3000-7000", t: "₹3k – 7k" },
    { id: "7000-plus", t: "₹7k+" },
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
      partner: g === "him" ? "your boyfriend or husband" : g === "her" ? "your girlfriend or wife" : "your partner",
      friend: "your friend", mom: "your mom", dad: "your dad", parents: "your parents",
      sibling: g === "him" ? "your brother" : g === "her" ? "your sister" : "your sibling",
      colleague: "a colleague", couple: "the couple",
      child: g === "him" ? "a little boy" : g === "her" ? "a little girl" : "a child",
    }[s.recipient];
    const why = { birthday: "Birthday", anniversary: "Anniversary", wedding: "Wedding", "just-because": "" }[s.occasion];
    return why ? `${why} ideas for ${who}` : `Ideas for ${who}, just because`;
  }

  // ---- ads (and the version stamp that refreshes cached searches after admin changes)
  const catalog = { ads: [], version: "" };
  const catalogReady = fetch("/api/catalog").then((r) => r.ok ? r.json() : null).then((d) => {
    if (d && Array.isArray(d.ads)) catalog.ads = d.ads;
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
        const go = document.createElement("span"); go.className = "go2"; go.textContent = live.length > 1 ? "Shop →" : `Shop ${ad.brand} →`; tx.appendChild(go);
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

  window.WTG = {
    RECIPIENTS, GENDERS, OCCASIONS, occasionsFor, SUGGESTIONS, BUDGETS, STORE_NAMES,
    asksGender, safeHref, toParams, fromParams, resultsTitle,
    catalog, catalogReady, pickAds, mountFeatured,
  };
})();
