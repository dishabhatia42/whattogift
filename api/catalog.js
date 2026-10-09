// Public, read-only: the live ad slots and the products pinned to the home-page board.
import { readData } from "./_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }
  try {
    const { ads, products, updatedAt } = await readData();
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      version: String(updatedAt || 0),
      ads: ads.filter((a) => a.active && (!a.endsOn || a.endsOn >= today)),
      board: products.filter((p) => p.active && p.board).slice(0, 10)
        .map(({ id, name, line, url, image, price }) => ({ id, name, line, url, image, price })),
    });
  } catch (err) {
    console.error(err);
    // The finder still works without ads, so fail soft.
    return res.status(200).json({ version: "0", ads: [], board: [] });
  }
}
