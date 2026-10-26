// Where an experience happens (a factory tour, a workshop, a class), so the card can say
// "📍 Mumbai" or "💻 Online". A tour is only a gift if they live near it.
import { interestScorer } from "./vocabulary.js";

// City, then the names a shop might use instead (areas, old names, nearby towns).
const CITIES = [
  ["Mumbai", ["mumbai", "bombay", "bandra", "andheri", "juhu", "worli", "lower parel", "colaba", "powai", "thane", "navi mumbai", "goregaon", "malad", "dadar", "byculla", "khar"]],
  ["Bengaluru", ["bengaluru", "bangalore", "koramangala", "indiranagar", "whitefield", "jayanagar", "hsr layout", "jp nagar", "malleshwaram"]],
  ["Delhi NCR", ["delhi", "new delhi", "gurugram", "gurgaon", "noida", "hauz khas", "mehrauli", "chhatarpur"]],
  ["Pune", ["pune", "koregaon park", "baner", "kalyani nagar"]],
  ["Hyderabad", ["hyderabad", "secunderabad", "jubilee hills", "banjara hills"]],
  ["Chennai", ["chennai", "madras"]],
  ["Kolkata", ["kolkata", "calcutta"]],
  ["Goa", ["goa", "panaji", "assagao", "anjuna"]],
  ["Jaipur", ["jaipur"]], ["Ahmedabad", ["ahmedabad"]], ["Kochi", ["kochi", "cochin"]], ["Chandigarh", ["chandigarh"]],
  ["Udaipur", ["udaipur"]], ["Mysuru", ["mysuru", "mysore"]], ["Coimbatore", ["coimbatore"]], ["Lucknow", ["lucknow"]],
  ["Puducherry", ["puducherry", "pondicherry", "auroville"]], ["Rishikesh", ["rishikesh"]], ["Coorg", ["coorg", "kodagu"]],
];
// Towns a shop names for a place that's really a trip from the big city.
const NEAR = { Mumbai: ["palghar", "wada", "alibaug", "karjat", "lonavala"], Bengaluru: ["hosur", "nandi hills"] };
const ONLINE = /\b(online|self[- ]paced|virtual|zoom|e-?course|recorded|live session on|webinar)\b/i;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
const word = (list) => new RegExp(`(?:^|[^a-z])(?:${list.map(esc).join("|")})(?![a-z])`, "i");
const PATTERNS = CITIES.map(([city, names]) => [city, word(names), NEAR[city] ? word(NEAR[city]) : null]);

// Every place named, in the order they appear: ["Mumbai", "Near Pune", "Online"], or [].
export function placesIn(text) {
  const t = String(text || "").replace(/[_/.]+/g, " "); // photo names: "chocolate-tour-wada-palghar-mumbai.jpg"
  const found = [];
  for (const [city, re, nearRe] of PATTERNS) {
    const m = t.search(re), n = nearRe ? t.search(nearRe) : -1;
    if (m < 0 && n < 0) continue;
    const near = n >= 0 || new RegExp(`near[\\s-]+(?:${CITIES.find((c) => c[0] === city)[1].map(esc).join("|")})`, "i").test(t);
    found.push([Math.min(...[m, n].filter((x) => x >= 0)), near ? `Near ${city}` : city]);
  }
  const places = found.sort((a, b) => a[0] - b[0]).map(([, p]) => p);
  if (ONLINE.test(t)) places.push("Online");
  return places;
}
// What the card says: one place by name, two joined ("Mumbai & Bengaluru"), more as "Multiple cities".
export function placeLabel(places) {
  if (!places.length) return "";
  if (places.length === 1) return places[0];
  if (places.length === 2) return `${places[0]} & ${places[1]}`;
  return "Multiple cities";
}
export const whereIs = (text) => placeLabel(placesIn(text));

// Only experiences get a place: a mug "made in Jaipur" doesn't need one.
const experience = interestScorer(["experiences"]);
export const isExperience = (i) => experience({ title: i.title || "", type: i.type || "", tags: i.tags || [], blurb: "" }) >= 2;

// The place for a catalogue item: worked out when the catalogue is read (`places`, from its full
// description), or from its name, short description and photo name if it hasn't been yet.
export function placesOf(i) {
  if (!isExperience(i)) return [];
  const found = Array.isArray(i.places) ? i.places : placesIn(`${i.title} ${i.blurb || ""} ${i.url || ""} ${i.image || ""}`);
  return found.length ? found : BRAND_PLACES[i.brandId] || [];
}
// Brands whose experience listings don't name the place: where they happen.
const BRAND_PLACES = {
  subko: ["Mumbai"], // tastings and workshops at their Bandra roastery
  araku: ["Bengaluru"], // at the Araku café, Indiranagar
  joinin: ["Delhi NCR"], // a Delhi NCR workshops marketplace
  planterie: ["Delhi NCR"], // terrarium workshops at their New Delhi studio
};

// "Near Mumbai" counts for Mumbai.
const cityOf = (place) => place.replace(/^Near /, "");

// Would this experience work for someone in `city` ("Mumbai", or "Online" for online only)?
// Not an experience: always fine. An experience with no known place: left out, since it
// could be anywhere.
export function fitsCity(i, city) {
  if (!city || !isExperience(i)) return true;
  const places = placesOf(i);
  if (city === "Online") return places.includes("Online");
  return places.some((p) => p === "Online" || cityOf(p) === city);
}

// How many experiences each city has (and Online), for the form's "Where are they?" choice.
// Memoised per catalogue version.
let cityMemo = { at: -1, counts: {} };
export function experienceCities(catalog) {
  if (cityMemo.at === catalog.updatedAt) return cityMemo.counts;
  const counts = {};
  for (const i of catalog.items || []) {
    if (!isExperience(i)) continue;
    for (const c of new Set(placesOf(i).map(cityOf))) counts[c] = (counts[c] || 0) + 1;
  }
  cityMemo = { at: catalog.updatedAt, counts };
  return counts;
}
// Every city name the form may send (plus "Online").
export const CITY_NAMES = [...CITIES.map(([c]) => c), "Online"];
export const placeOf = (i) => placeLabel(placesOf(i));

// ---- Dates on experiences: studios often leave last month's sessions marked "available".
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const YEAR = "(?:,?\\s*(20\\d\\d))?";
// Every session date in a listing ("14 Nov", "Nov 14th, 2026", "14/11/2026").
export function datesIn(text, now = new Date()) {
  const t = String(text || "").toLowerCase();
  const out = [];
  const add = (d, m, y) => {
    if (!(d >= 1 && d <= 31 && m >= 0 && m <= 11)) return;
    let date = new Date(Date.UTC(y || now.getUTCFullYear(), m, d));
    // No year: a date more than half a year back means next year's ("5 Jan", said in December).
    if (!y && now - date > 183 * 864e5) date = new Date(Date.UTC(now.getUTCFullYear() + 1, m, d));
    out.push(date);
  };
  for (const m of t.matchAll(new RegExp(`\\b${DAY}\\s*(?:-|of)?\\s*${MON}${YEAR}`, "g"))) add(+m[1], MONTHS.indexOf(m[2].slice(0, 3)), +m[3] || 0);
  for (const m of t.matchAll(new RegExp(`\\b${MON}\\s+${DAY}\\b${YEAR}`, "g"))) add(+m[2], MONTHS.indexOf(m[1].slice(0, 3)), +m[3] || 0);
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d\d)\b/g)) add(+m[1], +m[2] - 1, +m[3]);
  return out;
}
// A session that's over: every date it names has passed (or, with no dates, it names only past
// years: "Christmas 2024 workshop"). Undated listings count as current.
export function isPastDated(text, now = new Date()) {
  const dates = datesIn(text, now);
  const yesterday = now - 864e5;
  if (dates.length) return dates.every((d) => d < yesterday);
  const years = [...String(text || "").matchAll(/\b(20\d\d)\b/g)].map((m) => +m[1]);
  return years.length > 0 && years.every((y) => y < now.getUTCFullYear());
}
