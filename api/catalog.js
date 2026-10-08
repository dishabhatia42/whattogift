// Public, read-only: the live ad slots for the gift finder page.
import { readData } from "./_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }
  try {
    const { ads, updatedAt } = await readData();
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      version: String(updatedAt || 0),
      ads: ads.filter((a) => a.active && (!a.endsOn || a.endsOn >= today)),
    });
  } catch (err) {
    console.error(err);
    // The finder still works without ads, so fail soft.
    return res.status(200).json({ version: "0", ads: [] });
  }
}
