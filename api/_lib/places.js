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
  if (Array.isArray(i.places)) return i.places;
  return placesIn(`${i.title} ${i.blurb || ""} ${i.url || ""} ${i.image || ""}`);
}
export const placeOf = (i) => placeLabel(placesOf(i));
