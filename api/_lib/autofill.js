// Turns a product link into a filled-in product: fetches the page, pulls out
// what the store publishes about it (title, price, photo), and asks Claude to
// write the rest. Only called from the password-protected admin.
import Anthropic from "@anthropic-ai/sdk";
import { RECIPIENT_IDS, OCCASION_IDS, saveImage } from "./store.js";

const client = new Anthropic();
const MAX_PAGE_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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
  const url = safeProductUrl(rawUrl);
  if (!url) throw new UserError("Paste a full https:// product link.");

  const page = await readPage(url);
  const details = page
    ? [
        page.title && `Title: ${page.title}`,
        page.description && `Description: ${page.description}`,
        page.price && `Price on page: ${page.price}`,
        page.text && `Page text (excerpt): ${page.text}`,
      ].filter(Boolean).join("\n")
    : "The page couldn't be read (the store blocked it or it needs a browser).";

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Link: ${url}\n${details}` }],
  });
  const text = response.content.find((b) => b.type === "text")?.text;
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Couldn't read the AI's answer."); }

  // Keep a copy of the photo so it doesn't vanish if the store changes its image links.
  let image = "";
  if (page?.image) image = (await copyImage(page.image)) || page.image;

  return {
    url,
    name: data.name,
    note: data.note,
    price: page?.price ? formatRupees(page.price) || data.price : data.price,
    tags: data.tags,
    recipients: data.recipients,
    occasions: data.occasions,
    image,
    check: page ? data.check : `Couldn't open the page, so this is a best guess from the link. ${data.check}`.trim(),
  };
}

export class UserError extends Error {}

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
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
    });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return null;
    const html = (await res.text()).slice(0, MAX_PAGE_BYTES);
    const page = parsePage(html, res.url || url);
    return page.title || page.price || page.text ? page : null;
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
  const ldImage = [].concat(ld?.image || [])[0];
  const image = absolute(typeof ldImage === "string" ? ldImage : ldImage?.url || ldImage?.contentUrl, base) || absolute(meta("og:image"), base);
  const text = decode(html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
  return { title: title.trim(), description: description.trim().slice(0, 500), price, image, text };
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

async function copyImage(src) {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
    const type = (res.headers.get("content-type") || "").split(";")[0];
    if (!res.ok || !["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= MAX_IMAGE_BYTES ? await saveImage(buf, type) : null;
  } catch {
    return null;
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
