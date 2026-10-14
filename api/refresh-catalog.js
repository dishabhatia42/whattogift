// Nightly: re-reads every approved brand's product feed into the catalogue (see _lib/catalog.js).
// Scheduled by the cron in vercel.json. Vercel's cron sends "Authorization: Bearer <CRON_SECRET>",
// so CRON_SECRET must be set in the project's environment variables. (The admin page has its own
// "Refresh brand catalogue" button, behind the admin password.)
import { refreshCatalog } from "./_lib/catalog.js";
import { readBrands } from "./_lib/brands.js";
import { readPolicies, readMany, dueForReading } from "./_lib/returns.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers || {}).authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
  try {
    const started = Date.now();
    const catalog = await refreshCatalog();
    // Then re-check a few return policies older than a week, in whatever time is left. A changed
    // policy waits for Disha's approval; cards keep the approved label meanwhile.
    let policies = { done: 0, left: 0 };
    const spare = 50000 - (Date.now() - started);
    if (spare > 10000) {
      try {
        const [{ brands }, current] = await Promise.all([readBrands(), readPolicies()]);
        const { done, left } = await readMany(dueForReading(brands, current).slice(0, 8), spare - 5000);
        policies = { done, left };
      } catch (err) { console.warn("Return policy re-check skipped", err?.message); }
    }
    return res.status(200).json({ ...catalog, policies });
  } catch (err) {
    console.error("Catalogue refresh failed", err);
    return res.status(500).json({ error: "Couldn't refresh the catalogue." });
  }
}
