// Every link that leaves Serial Gifter passes through outbound() on the server, so it always:
//   - carries Disha's affiliate ID where she has one (e.g. Amazon's tag=serialgifte0a-21),
//   - otherwise carries UTM tags, so a brand sees "visits from serialgifter" in its own analytics,
//   - loses tracking junk picked up while browsing (srsltid, fbclid, Amazon's long ref strings).
// The affiliate rules are edited in the admin (Affiliates tab) and stored with the products.

export const DEFAULT_AFFILIATES = [{ domain: "amazon.in", param: "tag", value: "serialgifte0a-21" }];

const UTM = { utm_source: "serialgifter", utm_medium: "referral", utm_campaign: "gift_finder" };
// Big marketplaces ignore UTM tags (and Amazon's rules frown on extra parameters), so they only get affiliate IDs.
const MARKETPLACES = /(^|\.)(amazon\.in|amazon\.com|flipkart\.com|myntra\.com|nykaa\.com|ajio\.com|meesho\.com|tatacliq\.com)$/;
const JUNK = /^(srsltid|fbclid|gclid|gbraid|wbraid|igshid|mc_cid|mc_eid|_pos|_sid|_ss|_psq|_v|ref_?|pf_rd_\w+|pd_rd_\w+|content-id|crid|dib|dib_tag|qid|sprefix|sr|th|psc|social_share|linkCode|linkId|language)$/i;

export function outbound(url, affiliates = DEFAULT_AFFILIATES, { utm = true } = {}) {
  let u;
  try { u = new URL(url); } catch { return url; }
  if (u.protocol !== "https:") return url;
  const host = u.hostname.toLowerCase();

  // Amazon product pages: keep only the clean /dp/<id> address (the rest is session junk).
  if (/(^|\.)amazon\.in$/.test(host)) {
    const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    if (asin) u = new URL(`https://www.amazon.in/dp/${asin[1].toUpperCase()}`);
  }
  for (const key of [...u.searchParams.keys()]) if (JUNK.test(key)) u.searchParams.delete(key);

  const rule = affiliates.find((r) => host === r.domain || host.endsWith("." + r.domain));
  if (rule) u.searchParams.set(rule.param, rule.value);
  else if (utm && !MARKETPLACES.test(host)) {
    // Replace any UTM tags the link picked up elsewhere (e.g. copied from an Instagram ad): this visit is ours.
    for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key);
    for (const [k, v] of Object.entries(UTM)) u.searchParams.set(k, v);
  }
  return u.toString();
}

// Clean, safe affiliate rules from the admin: [{ domain, param, value }]. Missing = the defaults.
export function cleanAffiliates(list) {
  if (!Array.isArray(list)) return DEFAULT_AFFILIATES;
  return list.map((r) => ({
    domain: String(r?.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""),
    param: String(r?.param || "").trim(),
    value: String(r?.value || "").trim(),
  })).filter((r) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(r.domain) && /^[A-Za-z0-9_]{1,30}$/.test(r.param) && /^[\w.\-~]{1,80}$/.test(r.value)).slice(0, 20);
}

// Share links like amzn.in/d/abc or amzn.to/xyz redirect to the real product page, and an affiliate
// tag added to them is lost on the way. So when a product is saved, they're swapped for the full
// address they lead to (outbound() then trims it and adds the tag).
const SHORT_HOSTS = /^(amzn\.in|amzn\.to|amzn\.eu|a\.co|fkrt\.it|fkrt\.co|dl\.flipkart\.com|myntr\.it|nykaa\.me|bit\.ly|tinyurl\.com|rb\.gy)$/i;
export function isShortLink(url) {
  try { return SHORT_HOSTS.test(new URL(url).hostname); } catch { return false; }
}
export async function expandShortLink(url) {
  if (!isShortLink(url)) return url;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
    });
    const final = res.url && new URL(res.url);
    return final && final.protocol === "https:" && !isShortLink(final.toString()) ? final.toString() : url;
  } catch {
    return url; // couldn't reach it now: keep the short link rather than lose the product
  }
}

// Does this (already outbound()-processed) link earn us a commission? Used to label it "Affiliate link".
export function isAffiliate(url, affiliates = DEFAULT_AFFILIATES) {
  try {
    const u = new URL(url), host = u.hostname.toLowerCase();
    return affiliates.some((r) => (host === r.domain || host.endsWith("." + r.domain)) && u.searchParams.get(r.param) === r.value);
  } catch { return false; }
}

// Amazon's Associates agreement only allows Amazon prices that come from its own data service (with a
// timestamp). Prices typed in by hand for Amazon products are therefore never shown.
export function isAmazon(url) {
  try { return /(^|\.)amazon\.(in|com)$/i.test(new URL(url).hostname); } catch { return false; }
}
