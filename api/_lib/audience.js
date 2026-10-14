// Who a worn product is for. Shop data rarely says: of ~880 clothing items, under 30 mention
// women or men. So the brand tells us: a label whose clothes are mostly sarees, dupattas, kaftans
// and dresses is a women's label, even when a given "Embroidered Cotton Shirt" doesn't say so.
// Used only for things people wear; a candle or a notebook from a women's label suits anyone.

const WORN = /\b(shirt|top|tee|t-shirt|tank|pants|trousers|jeans|shorts|dress|skirt|kurta|kurti|saree|sari|blouse|dupatta|stole|scarf|kaftan|lehenga|jumpsuit|co-ord|jacket|blazer|hoodie|sweater|cardigan|shrug|loungewear|pyjama|pajama|nightwear|sneaker|shoe|sandal|slide|loafer|heel|cap|hat|earring|necklace|bracelet|bangle|choker|ring|pendant|anklet|jhumka|brooch|handbag|clutch|tote|sling|belt|watch)(?:s|es)?\b/i;
// Said outright about the product.
const FOR_HER = /\b(women|womens|woman|ladies|lady|female|girls?|her)\b|women's|\b(saree|sari|blouse|kurti|lehenga|dupatta|dress|skirt|kaftan|anarkali|salwar|palazzo|bralette|bra|lingerie|earring|jhumka|choker|necklace|bangle|nose ?pin|handbag|clutch)(?:s|es)?\b/i;
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
  const counts = new Map();
  for (const i of catalog.items || []) {
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
  memo = { at: catalog.updatedAt, lean };
  return lean;
}

// Should this product be left out when shopping for `gender` ("him" / "her")?
export function wrongFit(item, gender, lean) {
  if (gender !== "him" && gender !== "her") return false;
  if (!isWorn(item)) return false;
  const s = said(item);
  if (s === "any" || s === gender) return false;
  if (s) return true;                                   // explicitly for the other
  const other = gender === "him" ? "her" : "him";
  return lean.get(item.brandId) === other;              // unlabelled piece from the other's label
}
