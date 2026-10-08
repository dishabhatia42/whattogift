// Vercel serverless function: turns who + occasion + optional tags into gift ideas.
// It's a GET so Vercel's CDN can cache each answer: identical searches within
// CACHE_SECONDS are served free, without calling Claude again.
// Needs ANTHROPIC_API_KEY set in the Vercel project's environment variables.
import Anthropic from "@anthropic-ai/sdk";
import { readData } from "./_lib/store.js";

const client = new Anthropic();

const RECIPIENTS = {
  partner: "the shopper's romantic partner",
  friend: "a friend of the shopper",
  mom: "the shopper's mother",
  dad: "the shopper's father",
  parents: "the shopper's parents (one gift they can both enjoy)",
  sibling: "the shopper's sibling",
  colleague: "a work colleague (keep it professional and not too personal)",
  couple: "a couple (one shared gift for both)",
  child: "a child (age-appropriate and safe)",
};

const GENDERS = { him: "male", her: "female" };

const OCCASIONS = {
  birthday: "birthday",
  anniversary: "anniversary",
  wedding: "wedding",
  "just-because": "no special occasion, just because",
};

const BUDGETS = {
  "under-1000": "under ₹1,000",
  "1000-3000": "₹1,000 – ₹3,000",
  "3000-7000": "₹3,000 – ₹7,000",
  "7000-plus": "₹7,000 and above",
};

const STORES = ["amazon", "myntra", "nykaa", "flipkart"];
const CACHE_SECONDS = 12 * 60 * 60;
const VARIANTS = 3; // "Show different ideas" cycles through this many cached answers

const SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          why: { type: "string" },
          price_range: { type: "string" },
          search_query: { type: "string" },
          store: { type: "string", enum: STORES },
          tag: { type: "string" },
          product_id: { type: "string" },
        },
        required: ["name", "why", "price_range", "search_query", "store", "tag", "product_id"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

const SYSTEM = `You suggest thoughtful, specific gift ideas for shoppers in India.
Return 8 ideas. Each must be a concrete product type someone can actually buy online in India (e.g. "Bellavita unisex perfume gift set", not "something nice").
- name: short product name, brand included when a well-known Indian-available brand fits.
- why: one warm sentence on why it suits this person, occasion and interests. No fluff.
- price_range: realistic Indian price range in rupees, e.g. "₹1,200 – ₹1,800".
- search_query: a short query that will find this item on the chosen store (no URLs).
- store: the best Indian store for it: amazon (default), myntra (fashion), nykaa (beauty), flipkart.
- tag: one or two words grouping the idea (e.g. "Clothes", "Experience", "Tech").
- product_id: "" for your own ideas. The shopper's message may list hand-curated products, each with an id. Include every listed product that genuinely suits this person, budget and interests (most relevant first, up to 4), using its exact id, its name, and a price_range copied from its price. Spread them among the 8 ideas rather than all at the top. Never invent an id, and leave out listed products that don't fit.
Mix safe picks with one or two more personal or experience-style ideas. Respect the budget strictly when one is given. If the shopper's interests are given, cover each of them.`;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store"); // errors are never cached; success overrides below
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }

  const q = req.query || {};
  const body = {
    recipient: q.recipient,
    gender: q.gender,
    occasion: q.occasion,
    budget: q.budget,
    tags: typeof q.tags === "string" ? q.tags.split(",") : [],
  };
  const variant = Math.min(Math.max(parseInt(q.v, 10) || 1, 1), VARIANTS);
  const recipient = RECIPIENTS[body.recipient];
  const occasion = OCCASIONS[body.occasion];
  if (!recipient || !occasion) return res.status(400).json({ error: "Pick who it's for and the occasion." });

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t) => typeof t === "string").map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 8)
    : [];
  const budget = BUDGETS[body.budget] || null;

  const curated = await curatedProducts(body.recipient, body.occasion);
  const prompt = [
    `Gift for: ${recipient}${GENDERS[body.gender] ? ` (${GENDERS[body.gender]})` : ""}`,
    `Occasion: ${occasion}`,
    `Interests / keywords: ${tags.length ? tags.join(", ") : "none given, suggest broadly loved gifts"}`,
    `Budget: ${budget || "not specified, spread across price points"}`,
    variant > 1 ? `Variation ${variant}: avoid the most obvious picks, offer fresh alternatives.` : "",
    curated.length
      ? `Hand-curated products to consider (JSON):\n${JSON.stringify(curated.map(({ id, name, note, price, tags }) => ({ id, name, note, price, tags })))}`
      : "Hand-curated products to consider: none",
  ].filter(Boolean).join("\n");

  try {
    // Haiku: ~30x cheaper than Opus and plenty for picking 8 gift ideas.
    // It has no server-side refusal fallback; a refusal gets the friendly 422 below.
    const response = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 6000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "Couldn't suggest gifts for that. Try different keywords." });
    }
    const text = response.content.find((b) => b.type === "text")?.text;
    const data = text && safeJson(text);
    if (!data || !Array.isArray(data.ideas)) {
      return res.status(502).json({ error: "Got a garbled answer. Please try again." });
    }

    // Curated products keep Disha's exact link, photo and price; everything else gets a store search link.
    const byId = new Map(curated.map((p) => [p.id, p]));
    const used = new Set();
    const ideas = data.ideas.map(({ product_id, ...idea }) => {
      const product = byId.get(product_id);
      if (!product || used.has(product.id)) return { ...idea, url: storeUrl(idea.store, idea.search_query) };
      used.add(product.id);
      return { ...idea, name: product.name, price_range: product.price || idea.price_range, url: product.url, image: product.image, own: true };
    });
    res.setHeader("Cache-Control", `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`);
    return res.status(200).json({ ideas });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Lots of people are gifting right now. Try again in a minute." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return res.status(502).json({ error: "The idea engine hiccuped. Please try again." });
    }
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

// Active products Disha added that suit this person and occasion. Storage trouble
// shouldn't break the finder, so any failure just means no curated products.
async function curatedProducts(recipient, occasion) {
  try {
    const { products } = await readData();
    return products
      .filter((p) => p.active)
      .filter((p) => !p.recipients.length || p.recipients.includes(recipient))
      .filter((p) => !p.occasions.length || p.occasions.includes(occasion))
      .slice(0, 40);
  } catch (err) {
    console.error("Couldn't load curated products", err);
    return [];
  }
}

// Search links instead of product links: they never point at a made-up or sold-out page.
function storeUrl(store, query) {
  const q = encodeURIComponent(query);
  switch (store) {
    case "myntra": return `https://www.myntra.com/${encodeURIComponent(query.trim().toLowerCase().replace(/\s+/g, "-"))}?rawQuery=${q}`;
    case "nykaa": return `https://www.nykaa.com/search/result/?q=${q}`;
    case "flipkart": return `https://www.flipkart.com/search?q=${q}`;
    default: return `https://www.amazon.in/s?k=${q}`;
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}
