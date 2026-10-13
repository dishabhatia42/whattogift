// Owner-only: read and save ad slots, upload images. Every request must carry
// the ADMIN_PASSWORD (set in Vercel's environment variables) in x-admin-key.
import { createHash, timingSafeEqual } from "node:crypto";
import { readData, writeData, saveImage } from "./_lib/store.js";
import { autofill, UserError, aiTrouble } from "./_lib/autofill.js";
import { readCatalog, refreshCatalog, refreshBrand, dropBrand } from "./_lib/catalog.js";
import { readBrands, updateBrands, sameShop, slug, cleanDomain } from "./_lib/brands.js";
import { checkShop, suggestBrands, ScoutError } from "./_lib/scout.js";

// Finding brand suggestions searches the web, which can take a minute or two.
export const config = { maxDuration: 180 };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Uploads travel as base64 inside one request, and Vercel caps a request at 4.5 MB.
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) {
    return res.status(503).json({ error: "Admin is off: set ADMIN_PASSWORD (12+ characters) in Vercel." });
  }
  if (!sameSecret(req.headers["x-admin-key"], expected)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down password guessing
    return res.status(401).json({ error: "Wrong password." });
  }

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  try {
    switch (body.action) {
      case "load":
        return res.status(200).json(await readData());
      case "save":
        return res.status(200).json(await writeData(body.data));
      case "upload": {
        const video = VIDEO_TYPES.includes(body.contentType);
        if ((!IMAGE_TYPES.includes(body.contentType) && !video) || typeof body.base64 !== "string") {
          return res.status(400).json({ error: "Upload a JPEG, PNG or WebP image, or an MP4/WebM video." });
        }
        const buffer = Buffer.from(body.base64, "base64");
        if (!video && buffer.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Image is too large (2 MB max)." });
        if (video && buffer.length > MAX_VIDEO_BYTES) return res.status(413).json({ error: "Video is too large (3 MB max). Try a shorter clip." });
        return res.status(200).json({ url: await saveImage(buffer, body.contentType) });
      }
      case "autofill":
        return res.status(200).json(await autofill(body.url));
      case "refreshCatalog":
        return res.status(200).json(await refreshCatalog());
      case "catalogStatus": {
        const { updatedAt, brands, items } = await readCatalog({ fresh: true });
        return res.status(200).json({ updatedAt, brands, total: items.length });
      }

      // ---- Brands: Disha's list, plus AI suggestions she ticks or skips ----
      case "brandsLoad":
        return res.status(200).json(await readBrands());
      case "brandCheck":
        return res.status(200).json(await checkShop(body.link));
      case "brandAdd": {
        const wantName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
        let shop;
        try {
          shop = await checkShop(body.link || body.domain, { name: wantName });
        } catch (err) {
          // A suggestion already passed this check when it was found. If the shop's site is briefly
          // unreachable now (some rate-limit unfamiliar visitors), add it from that check anyway;
          // the nightly read tries its products again.
          const pending = (await readBrands()).suggestions.find((s) => sameShop(s.domain, cleanDomain(body.link || body.domain)));
          if (!pending) throw err;
          console.warn("Brand re-check failed, adding from its suggestion", pending.domain, err.message);
          shop = { name: wantName || pending.name, domain: pending.domain, platform: pending.platform };
        }
        let brand;
        const saved = await updateBrands((list) => {
          if (list.brands.some((b) => sameShop(b.domain, shop.domain))) throw new UserError(`${shop.name} is already in your brands.`);
          brand = { id: uniqueId(shop.name, list.brands), name: shop.name, domain: shop.domain, platform: shop.platform };
          return {
            ...list,
            brands: [...list.brands, brand],
            suggestions: list.suggestions.filter((s) => !sameShop(s.domain, shop.domain)),
            skipped: list.skipped.filter((d) => !sameShop(d, shop.domain)),
          };
        });
        // Its products are searchable straight away. If reading them fails, the brand is still
        // saved (the nightly read will try again), so this must not turn into an error.
        let catalog;
        try { catalog = await refreshBrand(brand); }
        catch (err) {
          console.error("Added brand, but couldn't read its products yet", brand.domain, err);
          const c = await readCatalog({ fresh: true });
          catalog = { updatedAt: c.updatedAt, total: c.items.length, brands: c.brands || [] };
        }
        return res.status(200).json({ ...saved, added: brand, catalog });
      }
      case "brandRemove": {
        let gone;
        const saved = await updateBrands((list) => {
          gone = list.brands.find((b) => b.id === body.id);
          if (!gone) throw new UserError("That brand isn't in your list.");
          return { ...list, brands: list.brands.filter((b) => b.id !== gone.id), skipped: [...list.skipped, gone.domain] };
        });
        const catalog = await dropBrand(gone.id);
        return res.status(200).json({ ...saved, catalog });
      }
      case "brandSkip": {
        const domain = String(body.domain || "");
        return res.status(200).json(await updateBrands((list) => ({
          ...list, suggestions: list.suggestions.filter((s) => !sameShop(s.domain, domain)), skipped: [...list.skipped, domain],
        })));
      }
      case "brandSuggest": {
        const list = await readBrands();
        const { items } = await readCatalog();
        const focus = typeof body.focus === "string" ? body.focus.replace(/[^\p{L}\p{N} ,&'-]/gu, "").trim().slice(0, 60) : "";
        const result = await suggestBrands({ brands: list.brands, skipped: list.skipped, pending: list.suggestions.map((s) => s.domain), catalogItems: items, focus });
        // Merged into the latest list, so brands added or skipped while the search ran stay that way.
        const saved = await updateBrands((latest) => ({
          ...latest,
          suggestions: [
            ...result.suggestions.filter((s) => !latest.brands.some((b) => sameShop(b.domain, s.domain)) && !latest.skipped.some((d) => sameShop(d, s.domain))),
            ...latest.suggestions,
          ],
          suggestedAt: Date.now(),
        }));
        return res.status(200).json({ ...saved, found: result.suggestions.length, stats: result.stats, theme: result.theme });
      }
      default:
        return res.status(400).json({ error: "Unknown action." });
    }
  } catch (err) {
    if (err instanceof UserError || err instanceof ScoutError) {
      console.warn(`Admin ${body?.action} refused:`, err.message, body?.domain || body?.link || "");
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    // Name the real problem: an AI error, or storage.
    if (err?.status && err?.headers) return res.status(502).json({ error: aiTrouble(err) });
    return res.status(500).json({ error: "Couldn't reach storage. Is a Blob store connected to this project?" });
  }
}

function uniqueId(name, brands) {
  const base = slug(name) || "brand";
  let id = base;
  for (let n = 2; brands.some((b) => b.id === id); n++) id = `${base}${n}`;
  return id;
}

function sameSecret(given, expected) {
  if (typeof given !== "string") return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}
