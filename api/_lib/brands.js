// Brands Disha has approved for the catalogue. Each must run on Shopify, whose public
// /products.json feed gives real names, prices, photos, stock and links (see catalog.js).
//   id      short, stable key (used in product ids; don't change it once live)
//   name    shown on cards as "by <name>" and on the "Shop at <name>" button
//   domain  the shop's own domain, no tracking bits
//   path    optional: a locale ("/in/en") or one collection ("/collections/saree") to read instead of the whole shop
//   skipTypes  optional: products to leave out (matched against type + title)
const NOT_GIFTS = /gift[ -]?card|e-?gift|voucher|\bsample|tester|refill pack|shipping|insurance|donation|add-?on|free[ _-]?gift|freebie|\btest(ing)?\b|upsell|trial pack/i;

export const BRANDS = [
  { id: "secretalchemist", name: "Secret Alchemist", domain: "secretalchemist.com" },
  { id: "entisi", name: "éntisi", domain: "entisi.com" },
  { id: "shuffle", name: "Shuffle Games", domain: "shufflegames.co.in", platform: "woocommerce" },
  { id: "oddgiraffe", name: "Odd Giraffe", domain: "oddgiraffe.com" },
  { id: "muddyjumpers", name: "The Muddy Jumpers", domain: "themuddyjumpers.com" },
  { id: "subko", name: "Subko", domain: "subko.coffee" },
  { id: "araku", name: "Araku Coffee", domain: "arakucoffee.in" },
  { id: "funclab", name: "The Func. Lab", domain: "thefunclab.com" },
  { id: "nappadori", name: "Nappa Dori", domain: "nappadori.com" },
  { id: "hibiscusmonkey", name: "Hibiscus Monkey", domain: "hibiscusmonkey.com" },
  { id: "suta", name: "Suta", domain: "suta.in" },
  { id: "smallbatch", name: "Small Batch", domain: "smallbatch.co.in" },
  { id: "sakhe", name: "Sakhe", domain: "sakhe.in" },
  { id: "peppystore", name: "The Peppy Store", domain: "thepeppystore.in" },
  { id: "figliving", name: "FIG Living", domain: "www.figliving.com" },
  { id: "molded", name: "Molded", domain: "moldedworld.com" },
  { id: "ugaoo", name: "Ugaoo", domain: "ugaoo.com" },
  { id: "homeessentials", name: "Home Essentials", domain: "homeessentials.in" },
  { id: "bombaysweetshop", name: "Bombay Sweet Shop", domain: "bombaysweetshop.com" },
  { id: "pauseproject", name: "Pause Project", domain: "pauseprojectindia.com" },
  { id: "polyparadise", name: "Poly Paradise", domain: "polyparadise.in", platform: "woocommerce" },
  { id: "sunshineclub", name: "Sunshine Club", domain: "sunshineclub.in" },
  { id: "lumuk", name: "Lumuk", domain: "lumuk.com" },
  { id: "spoilmesilly", name: "Spoil Me Silly", domain: "spoilmesilly.in" },
  { id: "devans", name: "Devans", domain: "www.devans.in" },
  { id: "fraganote", name: "Fraganote", domain: "www.fraganote.com" },
  { id: "sancha", name: "Sancha Tea", domain: "sanchatea.com" },
  { id: "lalaland", name: "Lalaland Jewellery Studio", domain: "lalalandjewellerystudio.com" },
  { id: "cosmix", name: "Cosmix", domain: "cosmix.in" },
  { id: "cuminco", name: "Cumin Co", domain: "www.cuminco.com" },
  { id: "lego", name: "LEGO", domain: "lego.in" },
].map((b) => ({ skipTypes: NOT_GIFTS, ...b }));
