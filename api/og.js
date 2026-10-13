// The link-preview picture (WhatsApp, iMessage, LinkedIn…), drawn from the products on the home board,
// so the preview always matches the site. Falls back to the static /og.jpg if anything goes wrong.
import { readFile } from "node:fs/promises";
import satori from "satori";
import sharp from "sharp";
import { readData } from "./_lib/store.js";
import { isAmazon } from "./_lib/links.js";

const W = 1200, H = 630;
const WINE = "#96364d", INK = "#26201e";
// Where the product cards sit on the right: [left, top, size, tilt]
const SPOTS = [[770, 66, 158, -7], [962, 112, 158, 6], [790, 268, 158, 5], [982, 318, 158, -6], [850, 440, 140, -3]];

// The fonts have no arrow glyph, so it's drawn.
const ARROW = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="#1e1915" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>').toString("base64")}`;

const font = (file) => readFile(new URL(`./_fonts/${file}`, import.meta.url));
let fonts;
const loadFonts = async () => (fonts ||= Promise.all([
  font("manrope-latin-800-normal.woff").then((data) => ({ name: "Manrope", data, weight: 800 })),
  font("manrope-latin-700-normal.woff").then((data) => ({ name: "Manrope", data, weight: 700 })),
  font("inter-latin-500-normal.woff").then((data) => ({ name: "Inter", data, weight: 500 })),
]));

const h = (type, style, children) => ({ type, props: { style, children } });

// Small JPEG thumbnail as a data URI, or null if the photo can't be fetched in time.
async function thumb(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const buf = await sharp(Buffer.from(await r.arrayBuffer()))
      .resize(300, 300, { fit: "cover", position: "attention" })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function card(src, [left, top, size, tilt]) {
  return {
    type: "div",
    props: {
      style: { position: "absolute", left, top, width: size, height: size, display: "flex", padding: 10, borderRadius: 24,
        background: "#ffffff", boxShadow: "0 14px 30px rgba(30,25,21,0.18)", transform: `rotate(${tilt}deg)` },
      children: { type: "img", props: { src, width: size - 20, height: size - 20, style: { borderRadius: 16, objectFit: "contain" } } },
    },
  };
}

export async function drawPreview(products) {
  // Board picks only. Amazon's photos stay on Amazon (their terms), and phone picks are the hand-chosen best six.
  const picks = products.filter((p) => p.active && p.board && p.image && !isAmazon(p.url))
    .sort((a, b) => (b.phone ? 1 : 0) - (a.phone ? 1 : 0));
  const photos = [];
  for (let i = 0; i < picks.length && photos.length < SPOTS.length; i += SPOTS.length) {
    const batch = await Promise.all(picks.slice(i, i + SPOTS.length).map((p) => thumb(p.image)));
    photos.push(...batch.filter(Boolean));
  }
  if (photos.length < 3) return null;

  const tree = h("div", { width: W, height: H, display: "flex", position: "relative", background: "#faf5f1", fontFamily: "Inter" }, [
    h("div", { position: "absolute", left: 28, top: 28, right: 28, bottom: 28, borderRadius: 34, border: "1.5px solid #eae2db",
      backgroundColor: "#fbfbf8", backgroundSize: "44px 44px",
      backgroundImage: "linear-gradient(rgba(110,175,200,0.26) 1px, transparent 1px), linear-gradient(90deg, rgba(110,175,200,0.26) 1px, transparent 1px)" }),
    h("div", { position: "absolute", left: 76, top: 70, fontFamily: "Manrope", fontWeight: 800, fontSize: 40, letterSpacing: -1.2, color: WINE }, "serialgifter"),
    h("div", { position: "absolute", left: 74, top: 236, width: 640, display: "flex", flexWrap: "wrap", fontFamily: "Manrope", fontWeight: 800,
      fontSize: 66, lineHeight: 1.03, letterSpacing: -2.3, color: INK }, [
      h("span", { marginRight: 16 }, "Less ordinary. More"),
      h("span", { color: WINE }, "“Oh my god, you remembered!”"),
    ]),
    h("div", { position: "absolute", left: 76, top: 476, width: 660, fontSize: 25, lineHeight: 1.4, color: "#4d443e" },
      "Thoughtful gift ideas, matched to the person you love."),
    ...photos.map((src, i) => card(src, SPOTS[i])),
    h("div", { position: "absolute", left: 990, top: 486, padding: "6px 14px", borderRadius: 10, background: "#ffffff",
      boxShadow: "0 6px 16px rgba(30,25,21,0.14)", fontFamily: "Manrope", fontWeight: 700, fontSize: 19, color: "#1e1915",
      transform: "rotate(4deg)", display: "flex", alignItems: "center" }, ["Find yours", { type: "img", props: { src: ARROW, width: 16, height: 16, style: { marginLeft: 7 } } }]),
  ]);
  const svg = await satori(tree, { width: W, height: H, fonts: await loadFonts() });
  return sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

export default async function handler(req, res) {
  try {
    const { products } = await readData();
    const jpg = await drawPreview(products);
    if (jpg) {
      res.setHeader("Content-Type", "image/jpeg");
      // Redrawn at most once a day; chat apps keep their own copy per link anyway.
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).send(jpg);
    }
  } catch (err) {
    console.error(err);
  }
  res.setHeader("Cache-Control", "public, s-maxage=600");
  res.setHeader("Location", "/og.jpg");
  return res.status(302).end();
}
