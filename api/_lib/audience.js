// Who a worn product is for. Shop data rarely says: of ~880 clothing items, under 30 mention
// women or men. So the brand tells us: a label whose clothes are mostly sarees, dupattas, kaftans
// and dresses is a women's label, even when a given "Embroidered Cotton Shirt" doesn't say so.
// Used only for things people wear; a candle or a notebook from a women's label suits anyone.

const WORN = /\b(shirt|top|tee|t-shirt|tank|pants|trousers|jeans|shorts|dress|skirt|kurta|kurti|saree|sari|blouse|dupatta|stole|scarf|kaftan|lehenga|jumpsuit|co-ord|jacket|blazer|hoodie|sweater|cardigan|shrug|loungewear|pyjama|pajama|nightwear|sneaker|shoe|sandal|slide|loafer|heel|cap|hat|earring|necklace|neckpiece|chain|bracelet|bangle|choker|ring|pendant|anklet|jhumka|brooch|ear cuff|cuff|huggie|stud|hoop|charm|handbag|clutch|tote|sling|belt|watch)(?:s|es)?\b/i;
// Jewellery. In Indian shops it's made for women unless it says otherwise, so for "him" a piece
// only stays if it says men's/unisex, or is a classic men's piece (a kada, cufflinks, a signet ring).
const JEWELLERY = /\b(ring|earring|ear cuff|cuff|necklace|neckpiece|chain|pendant|locket|bracelet|bangle|kada|choker|anklet|jhumka|brooch|huggie|stud|hoop|charm|nose ?pin|jewell?ery)(?:s|es)?\b/i;
// Things to keep jewellery in, not to wear.
const KEEPER = /\b(box|tray|organi[sz]er|stand|holder|case|pouch|dish|storage)(?:s|es)?\b/i;
const NOT_JEWELLERY = /\b(key ?rings?|napkin rings?|ring light|bag charms?|phone charms?|keychains?)\b/i;
const MENS_JEWELLERY = /\b(kada|cufflinks?|tie (?:pin|clip|bar)|lapel pin|signet)\b/i;
// Said outright about the product.
const FOR_HER = /\b(women|womens|woman|ladies|lady|female|girls?|her)\b|women's|\b(saree|sari|blouse|kurti|lehenga|dupatta|dress|skirt|kaftan|anarkali|salwar|palazzo|bralette|bra|lingerie|earring|jhumka|choker|necklace|bangle|nose ?pin|handbag|clutch|scrunchie|hair ?clip|hair ?pin|hair accessor(?:y|ie))(?:s|es)?\b/i;
const FOR_HIM = /\b(men|mens|man|male|boys?|him|beard|boxers?|briefs)\b|men's/i;
const UNISEX = /\bunisex\b|\bfor (all|everyone)\b/i;

const text = (i) => `${i.title || i.name || ""} ${i.type || ""} ${(i.tags || []).join(" ")}`;
export const isWorn = (i) => WORN.test(text(i)) || FOR_HER.test(text(i));
function said(i) {
  const t = text(i);
  if (UNISEX.test(t)) return "any";
  const her = FOR_HER.test(t), him = FOR_HIM.test(t);
  return her && !him ? "her" : him && !her ? "him" : "";
}

// Brand leanings from its worn products: "her", "him" or "" (mixed / not enough to tell).
// Memoised per catalogue version.
let memo = { at: -1, lean: new Map() };
export function brandLeanings(catalog) {
  if (memo.at === catalog.updatedAt) return memo.lean;
  const counts = new Map(), jewel = new Map();
  for (const i of catalog.items || []) {
    // How much of each brand is jewellery, and whether any of it says it's for men.
    const j = jewel.get(i.brandId) || { n: 0, jew: 0, men: 0 };
    j.n++; if (JEWELLERY.test(text(i)) && !KEEPER.test(text(i))) j.jew++; if (FOR_HIM.test(text(i))) j.men++;
    jewel.set(i.brandId, j);
    if (!isWorn(i)) continue;
    const c = counts.get(i.brandId) || { n: 0, her: 0, him: 0 };
    const s = said(i); c.n++; if (s === "her") c.her++; if (s === "him") c.him++;
    counts.set(i.brandId, c);
  }
  const lean = new Map();
  for (const [id, c] of counts) {
    if (c.n < 5) continue;
    if (c.her / c.n >= 0.3 && c.him / c.n < 0.1) lean.set(id, "her");
    else if (c.him / c.n >= 0.3 && c.her / c.n < 0.1) lean.set(id, "him");
  }
  // A jewellery label (most of what it sells is jewellery, almost none of it for men) is a women's
  // label: its rings and lockets often have names like "Knot Forever" that say nothing.
  for (const [id, j] of jewel) if (j.n >= 5 && j.jew / j.n >= 0.4 && j.men / j.n < 0.05) lean.set(id, "her-jewellery");
  memo = { at: catalog.updatedAt, lean };
  return lean;
}

// Should this product be left out when shopping for `gender` ("him" / "her")?
export function wrongFit(item, gender, lean) {
  if (gender !== "him" && gender !== "her") return false;
  // From a women's jewellery label, for "him": its jewellery, and pieces whose listing says
  // nothing at all ("Knot Forever" with no type or tags), are left out. Boxes, trays and
  // anything listed under another type (a candle, a cushion) stay.
  if (gender === "him" && lean.get(item.brandId) === "her-jewellery" && !KEEPER.test(text(item)) && !UNISEX.test(text(item)) && !FOR_HIM.test(text(item))
    && (JEWELLERY.test(text(item)) || !(item.type || (item.tags || []).length))) return true;
  if (!isWorn(item)) return false;
  const s = said(item);
  if (s === "any" || s === gender) return false;
  if (s) return true;                                   // explicitly for the other
  if (gender === "him" && JEWELLERY.test(text(item)) && !MENS_JEWELLERY.test(text(item)) && !NOT_JEWELLERY.test(text(item))) return true; // unlabelled jewellery
  const other = gender === "him" ? "her" : "him";
  const l = lean.get(item.brandId) === "her-jewellery" ? "her" : lean.get(item.brandId);
  return l === other;                                   // unlabelled piece from the other's label
}
