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

// "Mumbai", "Near Mumbai", "Online" or "".
export function whereIs(text) {
  const t = String(text || "").replace(/[_/.]+/g, " "); // photo names: "chocolate-tour-wada-palghar-mumbai.jpg"
  if (ONLINE.test(t)) return "Online";
  let best = "", at = Infinity;
  for (const [city, re, nearRe] of PATTERNS) {
    const m = t.search(re), n = nearRe ? t.search(nearRe) : -1;
    const near = n >= 0 || new RegExp(`near${"[\\s-]+"}(?:${CITIES.find((c) => c[0] === city)[1].map(esc).join("|")})`, "i").test(t);
    const pos = Math.min(...[m, n].filter((x) => x >= 0));
    if (pos < at) { at = pos; best = near ? `Near ${city}` : city; }
  }
  return best;
}

// Only experiences get a place: a mug "made in Jaipur" doesn't need one.
const experience = interestScorer(["experiences"]);
export const isExperience = (i) => experience({ title: i.title || "", type: i.type || "", tags: i.tags || [], blurb: "" }) >= 2;

// The place for a catalogue item: worked out when the catalogue is read (`where`, from its full
// description), or from its name, short description and photo name if it hasn't been yet.
export function placeOf(i) {
  if (!isExperience(i)) return "";
  if (typeof i.where === "string") return i.where;
  return whereIs(`${i.title} ${i.blurb || ""} ${i.url || ""} ${i.image || ""}`);
}
