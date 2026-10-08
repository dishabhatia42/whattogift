// Vercel serverless function: turns an occasion + optional tags into gift ideas.
// Needs ANTHROPIC_API_KEY set in the Vercel project's environment variables.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const OCCASIONS = {
  "her-birthday": "her birthday (a woman: friend, colleague, sister, etc.)",
  "his-birthday": "his birthday (a man: friend, colleague, brother, etc.)",
  "best-friend-birthday": "best friend's birthday",
  "boyfriend-birthday": "boyfriend's birthday",
  "anniversary": "wedding anniversary (gift for spouse)",
  "wedding": "wedding gift for a couple",
  "parents": "gift for parents",
};

const BUDGETS = {
  "under-1000": "under ₹1,000",
  "1000-3000": "₹1,000 – ₹3,000",
  "3000-7000": "₹3,000 – ₹7,000",
  "7000-plus": "₹7,000 and above",
};

const STORES = ["amazon", "myntra", "nykaa", "flipkart"];

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
        },
        required: ["name", "why", "price_range", "search_query", "store", "tag"],
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
- why: one warm sentence on why it suits this occasion and these interests. No fluff.
- price_range: realistic Indian price range in rupees, e.g. "₹1,200 – ₹1,800".
- search_query: a short query that will find this item on the chosen store (no URLs).
- store: the best Indian store for it: amazon (default), myntra (fashion), nykaa (beauty), flipkart.
- tag: one or two words grouping the idea (e.g. "Clothes", "Experience", "Tech").
Mix safe picks with one or two more personal or experience-style ideas. Respect the budget strictly when one is given. If the shopper's interests are given, cover each of them.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const occasion = OCCASIONS[body.occasion];
  if (!occasion) return res.status(400).json({ error: "Pick an occasion." });

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t) => typeof t === "string").map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 8)
    : [];
  const budget = BUDGETS[body.budget] || null;

  const prompt = [
    `Occasion: ${occasion}`,
    `Interests / keywords: ${tags.length ? tags.join(", ") : "none given, suggest broadly loved gifts"}`,
    `Budget: ${budget || "not specified, spread across price points"}`,
  ].join("\n");

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 6000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
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

    const ideas = data.ideas.map((idea) => ({ ...idea, url: storeUrl(idea.store, idea.search_query) }));
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
