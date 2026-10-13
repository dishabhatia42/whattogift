// "Drop a hint" pages: serialgifter.com/h/<product id>. A shared hint opens here, not on the brand's
// site, so the friend who receives it meets Serial Gifter too. WhatsApp, iMessage and others read the
// preview tags (product photo, name, price) without running any script, so they're written here
// on the server. The page shows the gift, a tracked "See it at <brand>" button, and an invitation
// to find a gift of their own.
import { readData } from "./_lib/store.js";
import { readCatalog } from "./_lib/catalog.js";
import { outbound, isAffiliate, isAmazon } from "./_lib/links.js";

const SITE = "https://www.serialgifter.com";

export default async function handler(req, res) {
  const id = String((req.query || {}).id || "").slice(0, 80);
  try {
    const [data, catalog] = await Promise.all([readData(), id.startsWith("o-") ? null : readCatalog()]);
    let gift = null;
    if (id.startsWith("o-")) {
      const p = data.products.find((x) => x.id === id.slice(2) && x.active);
      if (p) gift = { name: p.name, brand: new URL(p.url).hostname.replace(/^www\./, ""), price: p.price, image: p.image, url: p.url };
    } else {
      const p = catalog.items.find((x) => x.id === id);
      if (p) gift = { name: p.title, brand: p.brand, price: `${p.options ? "From " : ""}₹${p.price.toLocaleString("en-IN")}`, image: p.image, url: p.url };
    }
    if (!gift) { res.setHeader("Location", "/"); return res.status(302).end(); }
    gift.url = outbound(gift.url, data.affiliates);
    gift.affiliate = isAffiliate(gift.url, data.affiliates);
    if (isAmazon(gift.url)) gift.price = ""; // Amazon only allows prices from its own data service
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).send(page(gift, id));
  } catch (err) {
    console.error("Hint page failed", err);
    res.setHeader("Location", "/"); return res.status(302).end();
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function page(g, id) {
  const title = "Psst… a gift hint 👀";
  const desc = [g.name, g.price, g.brand && `from ${g.brand}`].filter(Boolean).join(" · ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · Serial Gifter</title>
<meta name="robots" content="noindex">
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(g.image || SITE + "/og.jpg")}">
<meta property="og:url" content="${SITE}/h/${esc(id)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Serial Gifter">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Ctext y=%27.9em%27 font-size=%2790%27%3E%F0%9F%8E%81%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/style.css">
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
<script defer src="https://cloud.umami.is/script.js" data-website-id="c8b41445-4155-4f3c-a497-19051f7171f6" data-domains="www.serialgifter.com,serialgifter.com"></script>
</head>
<body>
<header class="site-header"><div class="site-header-inner">
  <a class="logo" href="/" aria-label="Serial Gifter home"><span class="wordmark"><span class="name">serialgifter</span></span></a>
</div></header>
<main class="page hint-page">
  <header class="edit-hero">
    <p class="kicker">Psst… someone dropped you a hint 👀</p>
    <h1>They'd really love this.</h1>
  </header>
  <article class="card exact hint-card">
    <div class="pic photo">${g.image ? `<img src="${esc(g.image)}" alt="${esc(g.name)}">` : ""}</div>
    <div class="body">
      <h3>${esc(g.name)}</h3>
      <div class="meta"><span class="merchant">${g.brand ? `by ${esc(g.brand)}` : ""}</span><span class="price">${esc(g.price)}</span></div>
      <div class="acts">
        <a class="shop" href="${esc(g.url)}" target="_blank" rel="noopener noreferrer" data-umami-event="Hint shop click" data-umami-event-brand="${esc(g.brand)}" data-umami-event-product="${esc(String(g.name).slice(0, 80))}">${g.brand ? `See it at ${esc(g.brand)}` : "See it"} ↗</a>
      </div>
      ${g.affiliate ? '<p class="aff-note">Affiliate link: we may earn a commission at no extra cost to you.</p>' : ""}
    </div>
  </article>
  <section class="hint-invite">
    <h2 class="sec">Shopping for someone too?</h2>
    <p class="sub">Tell us who they are. We'll find something they'll actually love, from brands we love.</p>
    <a class="go" href="/" data-umami-event="Hint to finder">Find a gift for someone you love <span class="arr" aria-hidden="true">→</span></a>
  </section>
  <footer class="site-footer" id="site-footer">
    <p class="foot-disclosure">Some links may earn us a commission at no extra cost to you. As an Amazon Associate I earn from qualifying purchases. <a href="/legal">Terms &amp; Privacy</a></p>
  </footer>
</main>
<script src="/common.js"></script>
</body>
</html>`;
}
