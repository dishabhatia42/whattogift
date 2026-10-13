// Storage for the gift finder: one JSON document in Vercel Blob holding
// the products Disha adds herself and the sponsored ad slots. Needs BLOB_READ_WRITE_TOKEN,
// which Vercel adds automatically when a Blob store is connected to the project.
import { head, put } from "@vercel/blob";
import { cleanAffiliates } from "./links.js";

const DATA_PATH = "gift-finder/data.json";

export const RECIPIENT_IDS = ["partner", "friend", "mom", "dad", "parents", "sibling", "colleague", "couple", "child"];
export const OCCASION_IDS = ["birthday", "anniversary", "wedding", "just-because"];
export const AD_SLOTS = 5;
const MAX_PRODUCTS = 200;

// The latest saved version of a stored file, or null if it was never saved.
// Public Blob files are served through a CDN cache, and `get(..., { useCache: false })` only
// bypasses it for private files, so a read right after a save could return the previous
// version (and a read-change-save would then quietly undo the last change). Asking the Blob
// API for the file's current upload time and fetching that exact version avoids the cache.
export async function readFresh(path) {
  return (await readVersion(path))?.text ?? null;
}
async function readVersion(path) {
  let meta;
  try {
    meta = await head(path);
  } catch (err) {
    if (err?.name === "BlobNotFoundError" || /not.*found/i.test(String(err?.message))) return null;
    throw err;
  }
  const r = await fetch(`${meta.url}?v=${new Date(meta.uploadedAt).getTime()}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Storage read failed (${r.status})`);
  return { text: await r.text(), etag: meta.etag };
}

// Read, change, save, without losing someone else's save in between. Two actions at once
// (adding two brands in quick succession, or an add during the nightly refresh) would each
// read the same old copy, and the later save would wipe out the earlier one. So the save only
// goes through if the file is still the version we read (its ETag); otherwise we re-read and
// apply the change again. `change` gets the parsed file (or null) and returns the new contents.
export async function updateJson(path, change) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await readVersion(path);
    const next = await change(current ? JSON.parse(current.text) : null);
    try {
      await put(path, JSON.stringify(next), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        // First save: fail if someone else created it meanwhile. Later saves: only over the copy we read.
        ...(!current ? { allowOverwrite: false } : current.etag ? { ifMatch: current.etag } : { allowOverwrite: true }),
      });
      return next;
    } catch (err) {
      const clash = err?.name === "BlobPreconditionFailedError" || /precondition|already exists/i.test(String(err?.message));
      if (!clash) throw err;
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1) + Math.random() * 100));
    }
  }
  throw new Error("Lots of changes at once. Please try that again.");
}

export async function readData() {
  const text = await readFresh(DATA_PATH);
  if (text == null) return { products: [], ads: [], affiliates: cleanAffiliates() };
  try {
    const parsed = JSON.parse(text);
    return { ...clean(parsed), updatedAt: Number(parsed.updatedAt) || 0 };
  } catch {
    return { products: [], ads: [], affiliates: cleanAffiliates() };
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
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm" }[contentType];
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
    phone: p.board === true && p.phone === true, // one of the six the board shows on phones
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
      category: str(a.category, 40),  // shown under the tile, e.g. "Jewellery"
      url: httpsUrl(a.url),
      image: httpsUrl(a.image),
      video: httpsUrl(a.video),        // optional short looping clip; plays muted in the tile
      recipients: oneOf(a.recipients, RECIPIENT_IDS),
      occasions: oneOf(a.occasions, OCCASION_IDS),
      endsOn: /^\d{4}-\d{2}-\d{2}$/.test(a.endsOn) ? a.endsOn : "",
      active: a.active !== false,
    });
  }
  const ads = [...bySlot.values()].filter((a) => a.brand && a.url).sort((x, y) => x.slot - y.slot);
  return { products, ads, affiliates: cleanAffiliates(data?.affiliates) };
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
