// Brand scout for the admin.
//   checkShop(link)   reads a shop's public feed and says whether it can join the catalogue,
//                     with a few real sample products so Disha can judge it by eye.
//   suggestBrands()   "fans also like": Claude looks at the brands Disha already chose, searches
//                     the web for similar Indian D2C brands, and code checks each one with
//                     checkShop. Only shops that really work reach her, and only she adds them.
import Anthropic from "@anthropic-ai/sdk";
import { cleanDomain, sameShop } from "./brands.js";
import { sampleBrand } from "./catalog.js";

export class ScoutError extends Error {}

export async function checkShop(link, { name } = {}) {
  const domain = cleanDomain(link);
  if (!domain) throw new ScoutError("That doesn't look like a website link.");
  if (/(^|\.)(amazon|flipkart|myntra|nykaa|ajio|meesho|tatacliq|instagram|facebook)\./.test(domain)) {
    throw new ScoutError("That's a marketplace or social site. Paste the brand's own website, or add single products under Products.");
  }

  // Try the domain as given, then with/without "www.", first as Shopify, then WooCommerce.
  const hosts = [domain, domain.startsWith("www.") ? domain.slice(4) : `www.${domain}`];
  let found = null;
  for (const platform of ["shopify", "woocommerce"]) {
    for (const host of hosts) {
      try {
        const sample = await sampleBrand({ id: "check", name: name || host, domain: host, platform }, 30);
        found = { host, platform, sample };
        break;
      } catch { /* try the next one */ }
    }
    if (found) break;
  }
  if (!found) throw new ScoutError("This shop's website can't be read automatically (it isn't on Shopify or WooCommerce). Add its products one by one under Products instead.");

  const meta = found.platform === "shopify" ? await shopMeta(found.host) : {};
  const currency = meta.currency || found.sample.raw?.[0]?.prices?.currency_code || "";
  if (currency && currency !== "INR") throw new ScoutError(`This shop sells in ${currency}, not rupees, so its prices wouldn't make sense here.`);

  const items = found.sample.items;
  if (!items.length) throw new ScoutError("The shop can be read, but none of its first products are in stock with a photo and a price.");
  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const types = topTypes(items);
  return {
    name: (name || meta.name || vendorName(found.sample.raw) || prettyName(found.host)).slice(0, 60),
    domain: found.host,
    platform: found.platform,
    sells: types.join(", ").slice(0, 60),
    priceRange: prices.length > 1 && prices[0] !== prices.at(-1) ? `₹${fmt(prices[0])} – ₹${fmt(prices.at(-1))}` : `₹${fmt(prices[0])}`,
    samples: pickSamples(items).map(({ title, image, price }) => ({ title, image, price })),
  };
}

// Shopify's /meta.json carries the shop's own name and currency.
async function shopMeta(host) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://${host}/meta.json`, { signal: ctrl.signal, headers: { Accept: "application/json" } }).finally(() => clearTimeout(t));
    if (!r.ok) return {};
    const m = await r.json();
    return { name: typeof m.name === "string" ? m.name.trim() : "", currency: typeof m.currency === "string" ? m.currency.toUpperCase() : "" };
  } catch { return {}; }
}

// ---- Suggestions ----

const client = new Anthropic();

const SUGGEST_SYSTEM = `You help the founder of Serial Gifter, an Indian gift-finder, discover brands for her catalogue.
You'll get the brands she has already chosen (her taste) and brands she has said no to.
Use web search to find NEW Indian direct-to-consumer brands she would love: in the same spirit as her picks (independent, design-led, beautifully made, genuinely giftable), selling on their OWN website in rupees, ideally on Shopify. Spread across different kinds of gifts, including some her list doesn't cover yet. No marketplaces, no big conglomerates, nothing already on either list.
Finish with only a JSON array (no other text after it) of up to 14 brands:
[{"name": "Brand name", "domain": "brandsite.com", "sells": "what they make, 2-5 words", "why": "why it fits her taste, max 18 words"}]`;

export async function suggestBrands({ brands, skipped, pending, catalogItems }) {
  const sells = new Map();
  for (const i of catalogItems || []) {
    if (!sells.has(i.brandId)) sells.set(i.brandId, new Map());
    const m = sells.get(i.brandId);
    if (i.type) m.set(i.type, (m.get(i.type) || 0) + 1);
  }
  const mine = brands.map((b) => {
    const t = [...(sells.get(b.id) || new Map()).entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k]) => k);
    return `${b.name} (${b.domain})${t.length ? `: ${t.join(", ")}` : ""}`;
  });
  const prompt = [
    `Her brands:\n${mine.join("\n")}`,
    skipped.length ? `She said no to: ${skipped.slice(-150).join(", ")}` : "",
    pending.length ? `Already suggested, waiting for her: ${pending.join(", ")}` : "",
  ].filter(Boolean).join("\n\n");

  const messages = [{ role: "user", content: prompt }];
  let response;
  for (let turn = 0; turn < 3; turn++) {
    response = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      system: SUGGEST_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", country: "IN" } }],
      messages,
    });
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content }); // long searches pause; let it carry on
  }
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const ideas = parseList(text);

  // Every idea is checked for real; only working Indian shops with in-stock products survive.
  const taken = [...brands.map((b) => b.domain), ...skipped, ...pending];
  const fresh = ideas.filter((i) => {
    const d = cleanDomain(i.domain);
    return d && !taken.some((t) => sameShop(t, d));
  }).slice(0, 14);
  const checked = await Promise.all(fresh.map(async (i) => {
    try {
      const shop = await checkShop(i.domain, { name: i.name });
      return { ...shop, sells: String(i.sells || shop.sells).slice(0, 60), why: String(i.why || "").slice(0, 160) };
    } catch { return null; }
  }));
  return { suggestions: checked.filter(Boolean), tried: fresh.length };
}

function parseList(text) {
  const start = text.lastIndexOf("["), end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const list = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(list) ? list.filter((x) => x && typeof x.domain === "string") : [];
  } catch { return []; }
}

// ---- helpers ----

function topTypes(items) {
  const m = new Map();
  for (const i of items) if (i.type) m.set(i.type, (m.get(i.type) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
}
// Four samples, from different product types where possible.
function pickSamples(items) {
  const out = [], types = new Set();
  for (const i of items) if (out.length < 4 && !types.has(i.type)) { out.push(i); types.add(i.type); }
  for (const i of items) if (out.length < 4 && !out.includes(i)) out.push(i);
  return out;
}
function vendorName(raw) {
  const m = new Map();
  for (const p of raw || []) if (typeof p.vendor === "string" && p.vendor.trim()) m.set(p.vendor.trim(), (m.get(p.vendor.trim()) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}
function prettyName(host) {
  const base = host.replace(/^www\./, "").split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}
function fmt(n) { return Math.round(n).toLocaleString("en-IN"); }
