// Owner-only: read and save picks/ads, upload images. Every request must carry
// the ADMIN_PASSWORD (set in Vercel's environment variables) in x-admin-key.
import { createHash, timingSafeEqual } from "node:crypto";
import { readData, writeData, saveImage } from "./_lib/store.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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
        if (!IMAGE_TYPES.includes(body.contentType) || typeof body.base64 !== "string") {
          return res.status(400).json({ error: "Upload a JPEG, PNG or WebP image." });
        }
        const buffer = Buffer.from(body.base64, "base64");
        if (buffer.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Image is too large (2 MB max)." });
        return res.status(200).json({ url: await saveImage(buffer, body.contentType) });
      }
      default:
        return res.status(400).json({ error: "Unknown action." });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Couldn't reach storage. Is a Blob store connected to this project?" });
  }
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
