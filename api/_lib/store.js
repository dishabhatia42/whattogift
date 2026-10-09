// Storage for the gift finder: one JSON document in Vercel Blob holding
// the products Disha adds herself and the sponsored ad slots. Needs BLOB_READ_WRITE_TOKEN,
// which Vercel adds automatically when a Blob store is connected to the project.
import { get, put } from "@vercel/blob";

const DATA_PATH = "gift-finder/data.json";

export const RECIPIENT_IDS = ["partner", "friend", "mom", "dad", "parents", "sibling", "colleague", "couple", "child"];
export const OCCASION_IDS = ["birthday", "anniversary", "wedding", "just-because"];
export const AD_SLOTS = 5;
const MAX_PRODUCTS = 200;

export async function readData() {
  const result = await get(DATA_PATH, { access: "public", useCache: false });
  if (!result || result.statusCode !== 200) return { products: [], ads: [] };
  const text = await new Response(result.stream).text();
  try {
    const parsed = JSON.parse(text);
    return { ...clean(parsed), updatedAt: Number(parsed.updatedAt) || 0 };
  } catch {
    return { products: [], ads: [] };
  }
}

export async function writeData(data) {
  // updatedAt changes on every save; the page adds it to search URLs so cached
  // searches refresh as soon as products or ads change.
  const safe = { ...clean(data), updatedAt: Date.now() };
  await put(DATA_PATH, JSON.stringify(safe), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return safe;
}

export async function saveImage(buffer, contentType) {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[contentType];
  const blob = await put(`gift-finder/images/item.${ext}`, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

// Everything that goes in or out passes through here, so a bad save can't break the public page.
export function clean(data) {
  const products = (Array.isArray(data?.products) ? data.products : []).slice(0, MAX_PRODUCTS).map((p) => ({
    id: str(p.id, 40) || randomId(),
    name: str(p.name, 120),
    note: str(p.note, 300),
    price: str(p.price, 40),
    url: httpsUrl(p.url),
    image: httpsUrl(p.image),
    cutout: httpsUrl(p.cutout),  // the photo with its background removed, made in the admin
    recipients: oneOf(p.recipients, RECIPIENT_IDS),
    occasions: oneOf(p.occasions, OCCASION_IDS),
    tags: (Array.isArray(p.tags) ? p.tags : []).map((t) => str(t, 30)).filter(Boolean).slice(0, 10),
    board: p.board === true,   // shown as a sticker on the home-page board
    line: str(p.line, 140),    // Disha's one-liner shown when a sticker is opened
    active: p.active !== false,
  })).filter((p) => p.name && p.url);

  const bySlot = new Map();
  for (const a of Array.isArray(data?.ads) ? data.ads : []) {
    const slot = Number(a.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > AD_SLOTS) continue;
    bySlot.set(slot, {
      slot,
      brand: str(a.brand, 60),
      title: str(a.title, 120),
      tagline: str(a.tagline, 200),
      url: httpsUrl(a.url),
      image: httpsUrl(a.image),
      recipients: oneOf(a.recipients, RECIPIENT_IDS),
      occasions: oneOf(a.occasions, OCCASION_IDS),
      endsOn: /^\d{4}-\d{2}-\d{2}$/.test(a.endsOn) ? a.endsOn : "",
      active: a.active !== false,
    });
  }
  const ads = [...bySlot.values()].filter((a) => a.brand && a.title && a.url).sort((x, y) => x.slot - y.slot);
  return { products, ads };
}

function str(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function httpsUrl(v) {
  if (typeof v !== "string") return "";
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}
function oneOf(v, allowed) {
  return (Array.isArray(v) ? v : []).filter((o) => allowed.includes(o));
}
function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
