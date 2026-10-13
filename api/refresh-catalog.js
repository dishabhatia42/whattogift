// Nightly: re-reads every approved brand's product feed into the catalogue (see _lib/catalog.js).
// Scheduled by the cron in vercel.json. Vercel's cron sends "Authorization: Bearer <CRON_SECRET>",
// so CRON_SECRET must be set in the project's environment variables. (The admin page has its own
// "Refresh brand catalogue" button, behind the admin password.)
import { refreshCatalog } from "./_lib/catalog.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers || {}).authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
  try {
    return res.status(200).json(await refreshCatalog());
  } catch (err) {
    console.error("Catalogue refresh failed", err);
    return res.status(500).json({ error: "Couldn't refresh the catalogue." });
  }
}
