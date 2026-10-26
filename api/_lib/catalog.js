// The brand catalogue: real, in-stock products from brands Disha has approved.
// Most indie Indian brands run on Shopify, which publishes every product at
// https://<shop>/products.json (name, price, photos, stock, link). Once a night
// refreshCatalog() reads those feeds and saves a compact copy in Vercel Blob, so a
// search never waits on a brand's website and never shows a made-up product.
import { head } from "@vercel/blob";
import { readFresh, updateJson } from "./store.js";
import { readBrands, NOT_GIFTS } from "./brands.js";
import { isExperience, placesIn, isPastDated } from "./places.js";

const CATALOG_PATH = "gift-finder/catalog.json";
const PER_BRAND = 400;     // plenty for gifting; stops one huge shop crowding out the rest
const PAGE_SIZE = 250;     // Shopify's maximum per page
const FETCH_TIMEOUT = 12000;

// ---- Reading (used by every search) ----

let memo = null; // this server instance keeps the catalogue for a few minutes
export async function readCatalog({ fresh = false } = {}) {
  if (!fresh && memo && Date.now() - memo.at < 10 * 60 * 1000) return memo.data;
  try {
    const text = await readFresh(CATALOG_PATH);
    if (text == null) return { items: [], updatedAt: 0 };
    const data = JSON.parse(text);
    const clean = { items: Array.isArray(data.items) ? data.items : [], updatedAt: Number(data.updatedAt) || 0, brands: data.brands || [] };
    memo = { at: Date.now(), data: clean };
    return clean;
  } catch (err) {
    // A refresh must not carry on from an empty list and overwrite every other brand's products.
    if (fresh) throw err;
    console.error("Couldn't read the brand catalogue", err);
    return { items: [], updatedAt: 0 };
  }
}

// When the catalogue was last refreshed, without downloading it. The results page adds this to
// its search URLs, so cached answers never outlive the prices and stock they were made from.
export async function catalogVersion() {
  try {
    const meta = await head(CATALOG_PATH);
    return meta?.uploadedAt ? new Date(meta.uploadedAt).getTime() : 0;
  } catch {
    return 0; // not refreshed yet
  }
}

// ---- Refreshing (nightly cron, or the button in the admin) ----

export async function refreshCatalog() {
  const startedAt = Date.now();
  const { brands } = await readBrands();
  const results = await Promise.all(brands.map(readOne));
  // Saved safely (see updateJson), so a brand added or removed while this ran isn't undone.
  return save((old) => {
    const fetched = new Set(results.map((r) => r.brand.id));
    const items = [], report = [];
    for (const r of results) {
      // A brand whose site was down tonight keeps yesterday's products rather than vanishing.
      const kept = r.ok && r.items.length ? r.items : old.items.filter((i) => i.brandId === r.brand.id);
      items.push(...kept);
      report.push(reportLine(r, kept.length));
    }
    // Brands added in the admin while this ran keep the products they were just given.
    for (const b of old.brands) if (!fetched.has(b.id) && b.added > startedAt) {
      items.push(...old.items.filter((i) => i.brandId === b.id)); report.push(b);
    }
    return { items, report };
  });
}

// Just one brand, right after Disha adds it in the admin, so she sees it working at once.
export async function refreshBrand(brand) {
  const r = await readOne(brand);
  return save((old) => {
    const kept = r.ok && r.items.length ? r.items : old.items.filter((i) => i.brandId === brand.id);
    return {
      items: old.items.filter((i) => i.brandId !== brand.id).concat(kept),
      report: old.brands.filter((b) => b.id !== brand.id).concat({ ...reportLine(r, kept.length), added: Date.now() }),
    };
  });
}

// A removed brand's products leave the catalogue straight away.
export async function dropBrand(id) {
  return save((old) => ({ items: old.items.filter((i) => i.brandId !== id), report: old.brands.filter((b) => b.id !== id) }));
}

async function readOne(brand) {
  try {
    return { brand, items: await fetchBrand(brand), ok: true };
  } catch (err) {
    return { brand, items: [], ok: false, error: String(err?.message || err).slice(0, 120) };
  }
}
function reportLine(r, keptCount) {
  return { id: r.brand.id, name: r.brand.name, ok: r.ok, count: r.items.length, kept: !r.ok || !r.items.length ? keptCount : 0, error: r.error || "" };
}
async function save(change) {
  const data = await updateJson(CATALOG_PATH, (raw) => {
    const old = { items: Array.isArray(raw?.items) ? raw.items : [], brands: Array.isArray(raw?.brands) ? raw.brands : [] };
    const { items, report } = change(old);
    return { updatedAt: Date.now(), brands: report, items };
  });
  memo = { at: Date.now(), data: { items: data.items, updatedAt: data.updatedAt, brands: data.brands } };
  return { updatedAt: data.updatedAt, total: data.items.length, brands: data.brands };
}

// A quick look at a shop: its first few gift-worthy products, or an error saying why it can't be read.
export async function sampleBrand(brand, count = 12) {
  const woo = brand.platform === "woocommerce";
  const list = woo
    ? await fetchJson(`https://${brand.domain}/wp-json/wc/store/v1/products?per_page=${count}`, (d) => d)
    : await fetchJson(`https://${brand.domain}/products.json?limit=${count}`, (d) => d?.products);
  return { raw: list, items: list.map((p) => (woo ? wooItem(brand, p) : toItem(brand, p))).filter(Boolean) };
}

async function fetchBrand(brand) {
  const woo = brand.platform === "woocommerce";
  const size = woo ? 100 : PAGE_SIZE; // WooCommerce's maximum is 100
  const base = `https://${brand.domain}${brand.path || ""}`;
  const out = [];
  for (let page = 1; out.length < PER_BRAND && page <= Math.ceil(PER_BRAND / size) + 1; page++) {
    const products = woo
      ? await fetchJson(`https://${brand.domain}/wp-json/wc/store/v1/products?per_page=${size}&page=${page}`, (d) => d)
      : await fetchJson(`${base}/products.json?limit=${size}&page=${page}`, (d) => d?.products);
    if (!products.length) break;
    for (const p of products) {
      const item = woo ? wooItem(brand, p) : toItem(brand, p);
      if (item) out.push(item);
    }
    if (products.length < size) break;
  }
  return out.slice(0, PER_BRAND);
}

async function fetchJson(url, pick) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "SerialGifterBot/1.0 (+https://www.serialgifter.com)", Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const list = pick(await r.json());
    if (!Array.isArray(list)) throw new Error("not a product feed");
    return list;
  } finally {
    clearTimeout(timer);
  }
}

// WooCommerce shops (e.g. Shuffle Games) publish a similar public feed; prices come in paise.
export function wooItem(brand, p) {
  if (!p || !p.name || !p.is_in_stock || !p.is_purchasable) return null;
  const unit = Number(p.prices?.currency_minor_unit ?? 2);
  if (p.prices?.currency_code && p.prices.currency_code !== "INR") return null;
  const price = Number(p.prices?.price) / 10 ** unit;
  const regular = Number(p.prices?.regular_price) / 10 ** unit;
  if (!Number.isFinite(price) || price < 99) return null;
  const image = p.images?.[0]?.src;
  if (typeof image !== "string" || !image.startsWith("https://")) return null;
  const url = typeof p.permalink === "string" && p.permalink.startsWith(`https://${brand.domain}/`) ? p.permalink : "";
  if (!url) return null;
  const cats = (p.categories || []).map((c) => text(stripHtml(c.name), 24)).filter(Boolean);
  if (NOT_GIFTS.test(`${cats.join(" ")} ${p.name}`)) return null;
  if (isExperience({ title: p.name, type: cats[0] || "", tags: cats }) && isPastDated(p.name)) return null; // a session that's over
  return withPlace({
    id: `${brand.id}-${p.id}`,
    brandId: brand.id,
    brand: brand.name,
    title: text(stripHtml(p.name), 100),
    type: cats[0] || "",
    tags: cats.slice(1, 5),
    blurb: text(stripHtml(p.short_description || p.description), 110),
    price,
    was: Number.isFinite(regular) && regular > price ? regular : 0,
    options: p.type === "variable",
    url,
    image,
  }, stripHtml(`${p.short_description || ""} ${p.description || ""}`));
}

// Experiences (tours, workshops, classes) get where they happen, read from the full description,
// which is longer than the blurb we keep. Stored only when found.
function withPlace(item, fullText) {
  if (!isExperience(item)) return item;
  const places = placesIn(`${item.title} ${fullText} ${item.url} ${item.image}`);
  return places.length ? { ...item, places: places.slice(0, 12) } : item;
}

// One Shopify product -> one compact catalogue item, or null if it can't be shown honestly:
// it must be in stock, have a real price and a photo, and link to its own product page.
export function toItem(brand, p) {
  if (!p || typeof p.handle !== "string" || !p.title) return null;
  // Under ₹99 is a freebie, add-on or a shop's ₹1 test item, never a gift on its own.
  // Workshops and classes: sessions whose dates have passed are left out (studios often leave
  // last month's dates "available"); a listing with only past sessions isn't shown at all.
  const exp = isExperience({ title: p.title, type: p.product_type || "", tags: Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",") });
  const variants = (Array.isArray(p.variants) ? p.variants : []).filter((v) => v.available !== false && Number(v.price) >= 99
    && !(exp && isPastDated(`${p.title} ${v.title === "Default Title" ? "" : v.title || ""}`)));
  const prices = variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) return null;                       // sold out or no real price
  const image = p.images?.[0]?.src;
  if (typeof image !== "string" || !image.startsWith("https://")) return null;
  const type = text(p.product_type, 40);
  const rawTags = Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",");
  if (NOT_GIFTS.test(`${type} ${p.title} ${rawTags.join(" ")}`)) return null; // gift cards, samples, freebies
  const price = Math.min(...prices);
  const cheapest = variants.find((v) => Number(v.price) === price);
  const was = Number(cheapest?.compare_at_price);
  return withPlace({
    id: `${brand.id}-${p.id}`,
    brandId: brand.id,
    brand: brand.name,
    title: text(p.title, 100),
    type,
    tags: rawTags
      .map((t) => text(t, 24)).filter((t) => t && !/^(_|yotpo|judge|sale|new|all|bestseller|hide)/i.test(t)).slice(0, 4),
    blurb: text(stripHtml(p.body_html), 110),
    price,
    was: Number.isFinite(was) && was > price ? was : 0,
    options: variants.length > 1,
    // From a Diwali / festive range: stores say so in tags we don't keep (only 4 are kept).
    ...(FESTIVE_RANGE.test(`${p.title} ${type} ${rawTags.join(" ")} ${brand.path || ""}`) ? { festive: true } : {}),
    url: `https://${brand.domain}${brand.path?.startsWith("/collections") ? "" : brand.path || ""}/products/${encodeURIComponent(p.handle)}`,
    image: sized(image, 600),
  }, stripHtml(p.body_html));
}

const FESTIVE_RANGE = /\b(diwali|deepavali|dhanteras|festive|festival)/i;

// Shopify's image CDN resizes on the fly; 600px is sharp on a card and far lighter than the original.
function sized(src, width) {
  try {
    const u = new URL(src);
    if (u.hostname === "cdn.shopify.com" || u.pathname.includes("/cdn/shop/")) u.searchParams.set("width", String(width));
    return u.toString();
  } catch { return src; }
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, " ");
}
function text(v, max) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
