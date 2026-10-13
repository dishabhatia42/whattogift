// The brands in the catalogue, managed by Disha in the admin ("Brand catalogue").
// Stored in Vercel Blob next to everything else, together with the AI's brand
// suggestions and the ones she skipped (so they never come back).
// Each brand must run on Shopify (public /products.json) or WooCommerce (public Store API),
// which give real names, prices, photos, stock and links (see catalog.js).
//   id        short, stable key (used in product ids)
//   name      shown on cards as "by <name>" and on the "Shop at <name>" button
//   domain    the shop's own domain, no tracking bits
//   platform  "shopify" (default) or "woocommerce"
import { get, put } from "@vercel/blob";

const BRANDS_PATH = "gift-finder/brands.json";
const MAX_BRANDS = 150;

// Never gifts on their own: matched against each product's type, title and tags.
export const NOT_GIFTS = /gift[ -]?card|e-?gift|voucher|\bsample|tester|refill pack|shipping|insurance|donation|add-?on|free[ _-]?gift|freebie|\btest(ing)?\b|upsell|trial pack/i;

// The starting list, used until the first save from the admin.
const STARTER = [
  ["secretalchemist", "Secret Alchemist", "secretalchemist.com"],
  ["entisi", "éntisi", "entisi.com"],
  ["shuffle", "Shuffle Games", "shufflegames.co.in", "woocommerce"],
  ["oddgiraffe", "Odd Giraffe", "oddgiraffe.com"],
  ["muddyjumpers", "The Muddy Jumpers", "themuddyjumpers.com"],
  ["subko", "Subko", "subko.coffee"],
  ["araku", "Araku Coffee", "arakucoffee.in"],
  ["funclab", "The Func. Lab", "thefunclab.com"],
  ["nappadori", "Nappa Dori", "nappadori.com"],
  ["hibiscusmonkey", "Hibiscus Monkey", "hibiscusmonkey.com"],
  ["suta", "Suta", "suta.in"],
  ["smallbatch", "Small Batch", "smallbatch.co.in"],
  ["sakhe", "Sakhe", "sakhe.in"],
  ["peppystore", "The Peppy Store", "thepeppystore.in"],
  ["figliving", "FIG Living", "www.figliving.com"],
  ["molded", "Molded", "moldedworld.com"],
  ["ugaoo", "Ugaoo", "ugaoo.com"],
  ["homeessentials", "Home Essentials", "homeessentials.in"],
  ["bombaysweetshop", "Bombay Sweet Shop", "bombaysweetshop.com"],
  ["pauseproject", "Pause Project", "pauseprojectindia.com"],
  ["polyparadise", "Poly Paradise", "polyparadise.in", "woocommerce"],
  ["sunshineclub", "Sunshine Club", "sunshineclub.in"],
  ["lumuk", "Lumuk", "lumuk.com"],
  ["spoilmesilly", "Spoil Me Silly", "spoilmesilly.in"],
  ["devans", "Devans", "www.devans.in"],
  ["fraganote", "Fraganote", "www.fraganote.com"],
  ["sancha", "Sancha Tea", "sanchatea.com"],
  ["lalaland", "Lalaland Jewellery Studio", "lalalandjewellerystudio.com"],
  ["cosmix", "Cosmix", "cosmix.in"],
  ["cuminco", "Cumin Co", "www.cuminco.com"],
  ["lego", "LEGO", "lego.in"],
  ["comet", "Comet", "www.wearcomet.com"],
  ["gullylabs", "Gully Labs", "gullylabs.com"],
  ["latteholic", "Latteholic", "latteholic.com"],
  ["edit", "Edit", "editeveryday.com"],
].map(([id, name, domain, platform]) => ({ id, name, domain, platform: platform || "shopify" }));

export async function readBrands() {
  try {
    const result = await get(BRANDS_PATH, { access: "public", useCache: false });
    if (!result || result.statusCode !== 200) return clean({ brands: STARTER });
    return clean(JSON.parse(await new Response(result.stream).text()));
  } catch (err) {
    if (err?.name === "BlobNotFoundError") return clean({ brands: STARTER });
    throw err;
  }
}

export async function writeBrands(data) {
  const safe = clean(data);
  await put(BRANDS_PATH, JSON.stringify(safe), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return safe;
}

// Everything in or out passes through here, so a bad save can't break the nightly refresh.
function clean(d) {
  const seen = new Set();
  const brands = (Array.isArray(d?.brands) ? d.brands : []).map((b) => ({
    id: slug(b.id || b.name || b.domain),
    name: str(b.name, 60),
    domain: cleanDomain(b.domain),
    platform: b.platform === "woocommerce" ? "woocommerce" : "shopify",
  })).filter((b) => b.id && b.name && b.domain && !seen.has(b.domain) && seen.add(b.domain)).slice(0, MAX_BRANDS);
  const suggestions = (Array.isArray(d?.suggestions) ? d.suggestions : []).map((s) => ({
    name: str(s.name, 60),
    domain: cleanDomain(s.domain),
    platform: s.platform === "woocommerce" ? "woocommerce" : "shopify",
    why: str(s.why, 160),
    sells: str(s.sells, 60),
    priceRange: str(s.priceRange, 40),
    samples: (Array.isArray(s.samples) ? s.samples : []).slice(0, 4).map((p) => ({ title: str(p.title, 80), image: https(p.image), price: Number(p.price) || 0 })).filter((p) => p.image),
  })).filter((s) => s.name && s.domain && !seen.has(s.domain)).slice(0, 30);
  const skipped = [...new Set((Array.isArray(d?.skipped) ? d.skipped : []).map(cleanDomain).filter(Boolean))].slice(-500);
  return { brands, suggestions, skipped, suggestedAt: Number(d?.suggestedAt) || 0 };
}

// "https://www.Brand.com/collections/x?srsltid=…" -> "www.brand.com"
export function cleanDomain(v) {
  if (typeof v !== "string" || !v.trim()) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
    const host = u.hostname.toLowerCase();
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : "";
  } catch { return ""; }
}
// Two domains are the same shop if they differ only by "www."
export function sameShop(a, b) { return a.replace(/^www\./, "") === b.replace(/^www\./, ""); }

export function slug(v) {
  return String(v || "").toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "").replace(/^www/, "").slice(0, 24);
}
function str(v, max) { return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""; }
function https(v) { return typeof v === "string" && v.startsWith("https://") ? v : ""; }
