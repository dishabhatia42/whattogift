// Turns a product link into a filled-in product: fetches the page, pulls out
// what the store publishes about it (title, price, photo), and asks Claude to
// write the rest. Only called from the password-protected admin.
import { expandShortLink } from "./links.js";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { RECIPIENT_IDS, OCCASION_IDS, saveImage } from "./store.js";

const client = new Anthropic();
const MAX_PAGE_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // the original; it's shrunk to a small WebP before saving
const BROWSER = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
};

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    note: { type: "string" },
    price: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    recipients: { type: "array", items: { type: "string", enum: RECIPIENT_IDS } },
    occasions: { type: "array", items: { type: "string", enum: OCCASION_IDS } },
    check: { type: "string" },
  },
  required: ["name", "note", "price", "tags", "recipients", "occasions", "check"],
  additionalProperties: false,
};

const SYSTEM = `You catalogue products for an Indian gift-finder site. From the product link and whatever page details are given, fill in:
- name: short, clear product name with brand (max ~8 words).
- note: one warm sentence on what makes it a good gift and for whom.
- price: the selling price in rupees like "₹1,299", taken only from the page details. If no price is given, use "".
- tags: 3-6 lowercase keywords shoppers might type (category, style, interests).
- recipients: who it suits, from the allowed list. Use [] if it suits almost anyone.
- occasions: from the allowed list. Use [] if it works for any occasion (most products).
- check: one short sentence naming anything you guessed or couldn't confirm, or "" if all came from the page.
Never invent a price. If the page details are missing, work from the words in the link and say so in check.`;

export async function autofill(rawUrl) {
  const pasted = safeProductUrl(rawUrl);
  if (!pasted) throw new UserError("Paste a full https:// product link.");
  const url = await expandShortLink(pasted); // amzn.in/… share links -> the real product page

  const page = await readPage(url);
  const details = page
    ? [
        page.title && `Title: ${page.title}`,
        page.description && `Description: ${page.description}`,
        page.price && `Price on page: ${page.price}`,
        page.text && `Page text (excerpt): ${page.text}`,
      ].filter(Boolean).join("\n")
    : "The page couldn't be read (the store blocked it or it needs a browser).";

  // If the AI can't run (e.g. credits ran out), still fill in what the store page says.
  let data, aiProblem = "";
  try {
    // Haiku: filling in a note, tags and who it suits is light work, at a fraction of Opus's price.
    const response = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Link: ${url}\n${details}` }],
    });
    data = JSON.parse(response.content.find((b) => b.type === "text")?.text);
  } catch (err) {
    console.error(err);
    aiProblem = aiTrouble(err);
    if (!page?.title) throw new UserError(`${aiProblem} The page couldn't be read either, so please fill this one in by hand.`);
    data = { name: page.title.slice(0, 120), note: "", price: "", tags: [], recipients: [], occasions: [], check: "" };
  }

  // Keep a copy of the photo so it doesn't vanish if the store changes its image links. Tries
  // each photo the page offers (the product's own first, logos last) until one copies.
  let image = "", photoNote = "";
  const photos = page?.images?.length ? page.images : await shopifyImages(url);
  for (const src of photos.slice(0, 5)) { image = await copyImage(src, url); if (image) break; }
  if (!image) photoNote = page ? "Couldn't copy a photo from the page; please add one." : "";

  return {
    url,
    name: data.name,
    note: data.note,
    price: page?.price ? formatRupees(page.price) || data.price : data.price,
    tags: data.tags,
    recipients: data.recipients,
    occasions: data.occasions,
    image,
    check: [aiProblem
      ? `${aiProblem} Name, price and photo came from the store page; add the description, keywords and who it's for yourself.`
      : page ? data.check : `Couldn't open the page (the store blocks automatic visits), so this is a best guess from the link; please add the photo yourself. ${data.check}`.trim(), photoNote].filter(Boolean).join(" "),
  };
}

export class UserError extends Error {}

// A plain-English reason the AI step failed, for the admin screen.
export function aiTrouble(err) {
  const msg = String(err?.error?.error?.message || err?.message || "");
  if (/credit balance/i.test(msg)) return "Your Anthropic credits have run out (top up at console.anthropic.com → Billing).";
  if (err?.status === 401) return "The ANTHROPIC_API_KEY in Vercel isn't working.";
  if (err?.status === 429 || err?.status === 529) return "The AI is busy right now. Try again in a minute.";
  return "The AI couldn't help with this one right now.";
}

function safeProductUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    if (u.protocol !== "https:") return null;
    // Only public websites: no localhost or raw IP addresses.
    if (u.hostname === "localhost" || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(":")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function readPage(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { ...BROWSER, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return null;
    const html = (await res.text()).slice(0, MAX_PAGE_BYTES);
    const page = parsePage(html, res.url || url);
    return page.title || page.price || page.images.length ? page : null;
  } catch {
    return null;
  }
}

function parsePage(html, base) {
  const meta = (name) => {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] || "") : "";
  };
  const ld = jsonLdProduct(html);
  const title = ld?.name || meta("og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "");
  const description = ld?.description || meta("og:description") || meta("description");
  const offer = [].concat(ld?.offers || [])[0];
  const price = String(offer?.price || offer?.lowPrice || meta("product:price:amount") || meta("og:price:amount") || meta("price") || "");
  // Every photo the page names, best first: the product's structured data, its share images,
  // and Amazon's gallery (Amazon has no share image). Site logos go last.
  const metas = (name) => [...html.matchAll(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*>`, "gi"))]
    .map((m) => decode(m[0].match(/content=["']([^"']*)["']/i)?.[1] || ""));
  const found = [
    ...[].concat(ld?.image || []).map((i) => (typeof i === "string" ? i : i?.url || i?.contentUrl)),
    ...metas("og:image"), ...metas("og:image:secure_url"), ...metas("twitter:image"), ...metas("image"),
    html.match(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)/i)?.[1],
    html.match(/data-old-hires=["']([^"']+)/i)?.[1],
    html.match(/"hiRes":"([^"]+)"/)?.[1],
    html.match(/id=["']landingImage["'][^>]*src=["']([^"']+)/i)?.[1],
  ].map((u) => absolute(u && decode(u), base)).filter(Boolean);
  const isLogo = (u) => /logo|favicon|sprite|placeholder|\.svg(\?|$)/i.test(u);
  const images = [...new Set([...found.filter((u) => !isLogo(u)), ...found.filter(isLogo)])];
  const text = decode(html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
  return { title: title.trim(), description: description.trim().slice(0, 500), price, images, text };
}

function jsonLdProduct(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findProduct(JSON.parse(m[1]));
      if (found) return found;
    } catch {}
  }
  return null;
}
function findProduct(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const f = findProduct(n); if (f) return f; } return null; }
  const type = [].concat(node["@type"] || []);
  if (type.includes("Product")) return node;
  return findProduct(node["@graph"]);
}

// Download a photo and keep a small WebP copy. Big originals (stores often serve 3-5 MB photos),
// AVIF or GIF all work; the request looks like a browser on the product page, since some stores
// refuse photo requests that don't.
async function copyImage(src, pageUrl) {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(10000), headers: { ...BROWSER, Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: pageUrl } });
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") || "image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
    const img = sharp(buf, { animated: false }).rotate();
    const { width = 0, height = 0 } = await img.metadata();
    if (Math.max(width, height) < 200) return null; // an icon, not a product photo
    const small = await img.resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return await saveImage(small, "image/webp");
  } catch {
    return null;
  }
}

// Shopify shops that block page visits still answer /products/<handle>.js with the photos.
async function shopifyImages(url) {
  try {
    const u = new URL(url);
    if (!/\/products\/[^/]+/.test(u.pathname)) return [];
    const res = await fetch(`${u.origin}${u.pathname.replace(/\/$/, "")}.js`, { signal: AbortSignal.timeout(8000), headers: BROWSER });
    if (!res.ok) return [];
    const p = await res.json();
    return [].concat(p.featured_image || [], p.images || []).map((i) => absolute(String(i), url)).filter(Boolean);
  } catch {
    return [];
  }
}

function formatRupees(v) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? "₹" + Math.round(n).toLocaleString("en-IN") : "";
}
// Store images are often listed as http:// or //host/...; serve them over https.
function absolute(u, base) {
  if (!u) return "";
  try {
    const x = new URL(u, base);
    if (x.protocol === "http:") x.protocol = "https:";
    return x.protocol === "https:" ? x.toString() : "";
  } catch {
    return "";
  }
}
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8377;/g, "₹").replace(/&nbsp;/g, " ");
}
