#!/usr/bin/env node
/**
 * Importeert de DARF Versvoer-catalogus (kof=107).
 *
 * De categoriepagina's zijn Angular-SSR: elke productkaart heeft eigen velden
 * voor merk, naam, gewicht en prijs. De detailpagina's zijn ook server-rendered
 * en bevatten de ingredienten, de samenstelling en de analyse. Die gebruiken we
 * om heel-dierproducten (ALRODA Puur) te onderscheiden van losse delen (BARF
 * Puur pens, lever, bot) en van complete KVV-maaltijden.
 *
 * Resultaat:
 *   - data/darf-products.json  (snapshot voor de app)
 *   - .data/oervoer.db         (tabel shop_products)
 *
 * Gebruik:
 *   node scripts/import-darf.mjs               # 15 pagina's, detailcache
 *   node scripts/import-darf.mjs --refresh     # detailpagina's opnieuw ophalen
 *   node scripts/import-darf.mjs --no-details  # alleen kaartdata (snel)
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const BASE = "https://darf.nl";
const PAGES = 15;
const DETAIL_CONCURRENCY = 4;
const REFRESH = process.argv.includes("--refresh");
const NO_DETAILS = process.argv.includes("--no-details");
// Alleen de bestaande snapshot normaliseren (labels gelijktrekken, energie
// aanvullen) zonder het net op te gaan.
const NORMALISE_ONLY = process.argv.includes("--normalise-only");
const CACHE_DIR = path.join(process.cwd(), ".data", "darf-cache");

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "accept-language": "nl-NL,nl;q=0.9",
};

/** Alle dieren die als smaak in een productnaam kunnen voorkomen. */
const FLAVORS = [
  "KIP", "RUND", "LAM", "EEND", "ZALM", "HERT", "KONIJN", "GEIT", "PAARD",
  "GANS", "DUIF", "KALKOEN", "KALF", "ELAND", "FAZANT", "REE", "KWARTEL",
  "PARELHOEN", "PATRIJS", "SCHAAP", "VARKEN", "HARING", "MAKREEL", "SPROT",
  "SARDINE", "KABELJAUW", "HEEK", "KOOLVIS", "POON", "SCHELVIS",
];

const ORGAN = /(lever|hart|long|nier|maag|boekmaag|organen|orgaan|testikel|zwezerik|klier|milt|alvleesklier)/i;
const PENS = /pens/i;
const BONE = /(botten?|bot|karkas|kraakbeen|nek|nekken|rug|kop|koppen|poot|poten|rib|ribben|sparerib|vleugel|vleugelpunt)/i;
const MUSCLE = /(spier|filet|vlees|blokjes|biefstuk|stoofvlees|bout|schouder|dij|borst|worst|gehakt|gemalen)/i;
const FISH = /(vis|zalm|haring|makreel|kabeljauw|heek|koolvis|poon|schelvis|sprot|sardine|forel|wijting)/i;
const COMPLETE = /(kvv|classic|compleet|actief|puppy|\bpup\b|small|all in one|groente|worstjes|noordzee|\b10 x\b)/i;

function decode(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&euro;/g, "€")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textOf(html) {
  return decode(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function field(block, className) {
  const match = block.match(
    new RegExp(`class="${className}"[^>]*>([\\s\\S]*?)</`),
  );
  return match ? textOf(match[1]) : "";
}

function parseWeight(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Math.round(value * (match[2].toLowerCase() === "kg" ? 1000 : 1));
}

function weightFromSlug(slug) {
  // 245-g, 4-65-kg, 10-kg, 500g
  const match = slug.match(/(?:-|_)(\d+)(?:-(\d+))?-(kg|g)$/i) ?? slug.match(/(\d+)(?:-(\d+))?-(kg|g)$/i);
  if (!match) return null;
  const whole = Number.parseInt(match[1], 10);
  const fraction = match[2] ? Number.parseInt(match[2], 10) : 0;
  const value = fraction ? whole + fraction / 10 ** String(match[2]).length : whole;
  return Math.round(value * (match[3].toLowerCase() === "kg" ? 1000 : 1));
}

function parsePrice(text) {
  const match = text.match(/€\s*([\d.]+,\d{2})/);
  if (!match) return null;
  return Math.round(Number.parseFloat(match[1].replace(/\./g, "").replace(",", ".")) * 100);
}

function classifyAnimal(text) {
  if (/\bkat\b|katten/i.test(text)) return "KAT";
  if (/\bhond\b|honden/i.test(text)) return "HOND";
  return "BEIDE";
}

function classifyFlavor(text) {
  const upper = text.toUpperCase();
  // Plaatsnamen staan vaak in een samenstelling: Kippenlever, Runderhart,
  // Lamsbot, Eendennekken. Daarom op woordbegin matchen, niet op heel woord.
  const match = FLAVORS.find((flavor) => new RegExp(`\\b${flavor}`).test(upper));
  if (match) return match;
  if (/ganzen/i.test(text)) return "GANS";
  if (FISH.test(text)) return "VIS";
  return "";
}

/**
 * Los deel op basis van de productnaam. Heel-dierproducten hebben geen
 * deelwoord in de naam; die vallen hier dus niet in.
 */
function loosePartOf(rawName) {
  const name = rawName.replace(/vleesworst/gi, " ");
  if (FISH.test(name)) return "vis";
  if (PENS.test(name)) return "pens";
  if (ORGAN.test(name)) return "orgaan";
  if (/karkas/i.test(name)) return "karkas";
  // "Rundernekspier" is spier, geen bot; daarom spier vóór bot.
  if (MUSCLE.test(name)) return "spier";
  if (BONE.test(name)) return "bot";
  if (/vet\b/i.test(name)) return "vet";
  return "";
}

function isWholeAnimalCandidate(brand, name) {
  if (brand !== "ALRODA") return false;
  if (!/\bPuur\b/i.test(name)) return false;
  // ALRODA Puur Pens/Hart/Lever/Long/Boekmaag zijn losse delen, geen heel dier.
  return loosePartOf(name.replace(/\bPuur\b/gi, "")) === "";
}

async function fetchText(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (response.status === 404) return { status: 404, html: "" };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { status: response.status, html: await response.text() };
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  return { status: 0, html: "" };
}

async function scrapeCards() {
  const bySlug = new Map();
  for (let page = 1; page <= PAGES; page += 1) {
    const url = `${BASE}/product?kof=107&p=${page}`;
    const { html } = await fetchText(url);
    const cardPattern =
      /<a\b[^>]*class="pcard"[^>]*href="\/product\/([^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;
    while ((match = cardPattern.exec(html))) {
      count += 1;
      const slug = match[1];
      const block = match[2];
      if (bySlug.has(slug)) continue;

      const brand = field(block, "pcard-brand");
      const shortName = field(block, "pcard-name");
      const name = [brand, shortName].filter(Boolean).join(" ").trim();
      const labels = field(block, "pcard-labels");
      const weightText = field(block, "pcard-weight");
      const priceText = field(block, "pcard-price");
      const weightG = parseWeight(weightText) ?? weightFromSlug(slug);
      const priceCents = parsePrice(priceText);

      bySlug.set(slug, {
        slug,
        url: `${BASE}/product/${slug}`,
        name,
        brand,
        weightG,
        priceCents,
        available: !/niet leverbaar|uitverkocht/i.test(labels),
        animal: classifyAnimal(name),
        flavor: classifyFlavor(name),
        part: "",
        wholeAnimal: false,
        ingredients: "",
        composition: [],
        description: "",
        analysis: {},
      });
    }
    process.stdout.write(`pagina ${page}: ${count} kaarten\n`);
  }
  return [...bySlug.values()];
}

function detailCacheFile(slug) {
  return path.join(CACHE_DIR, `${slug}.json`);
}

/**
 * De analyse op de DARF-detailpagina's gebruikt per product andere labels
 * ("Ruw eiwit", "Ruw Eiwit", "Ruwe eiwit", "Ruw eitwit", "Vezels", "Ruwe
 * celstof", "Energie", "Energie Kcal / 100g", "Clacium", "Ca:P verhouding").
 * Zonder gelijktrekken verdwijnt meer dan de helft van de waarden in losse
 * sleutels, dus alles gaat naar één canonieke set met getallen.
 */
const ANALYSIS_ALIASES = [
  [/^vocht/, "vocht"],
  [/eiwit|eitwit/, "eiwit"],
  [/^ruwe?\s*vet$|^vet$/, "vet"],
  [/celstof|celsof|vezel/, "celstof"],
  [/^ruwe?\s*as$|^as$/, "as"],
  [/calcium|clacium/, "calcium"],
  [/fosfor/, "fosfor"],
  [/^ca\s*[\/:±]\s*p/, "caP"],
  [/energie/, "energieKcalPer100g"],
];

export function canonicalAnalysisKey(label) {
  const key = String(label).toLowerCase().replace(/\s+/g, " ").trim();
  for (const [pattern, canonical] of ANALYSIS_ALIASES) {
    if (pattern.test(key)) return canonical;
  }
  return null;
}

/** "0,13" → 0.13, "152.9 kcal" → 152.9, "1,4:1" → 1.4; anders null. */
export function analysisValue(raw) {
  if (raw === undefined || raw === null) return null;
  const match = String(raw).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
}

/** Zet de ruwe analyse om naar canonieke sleutels met getallen. */
export function normaliseAnalysis(analysis) {
  const out = {};
  for (const [label, value] of Object.entries(analysis ?? {})) {
    const key = canonicalAnalysisKey(label) ?? label;
    const parsed = analysisValue(value);
    if (out[key] === undefined && parsed !== null) out[key] = parsed;
  }
  return out;
}

/**
 * Energie schatten met de gemodificeerde Atwater-factoren (4/9/4) uit vocht,
 * eiwit, vet, celstof en as. Alleen gebruikt als de fabrikant zelf geen
 * energiewaarde publiceert; de uitkomst wordt als schatting gemarkeerd. Op de
 * 97 producten waar beide bekend zijn wijkt dit gemiddeld 7,4% af van de
 * opgave (de EU-factoren 3,5/8,5/3,5 komen op 11,4% uit).
 */
export function estimateEnergy(analysis) {
  const { vocht, eiwit, vet, as } = analysis ?? {};
  const celstof = analysis?.celstof ?? 0;
  if ([vocht, eiwit, vet, as].some((value) => typeof value !== "number")) return null;
  const nfe = 100 - (vocht + eiwit + vet + celstof + as);
  if (nfe < 0) return null;
  return Math.round(4 * eiwit + 9 * vet + 4 * nfe);
}

function parseDetail(html) {
  const rendered = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const title = field(rendered, "pdp-title");
  const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const price = rendered.match(/class="pdp-price"[^>]*>([\s\S]*?)<\/span>/i);
  const ingredientsBlock = rendered.match(
    /class="dc-fineprint"[^>]*>([\s\S]*?)<\/div>/i,
  );

  const heroes = [];
  const heroPattern =
    /class="dc-hero-name"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,400}?class="dc-hero-pct"[^>]*>[\s\S]*?<b[^>]*>(\d+)<\/b>/gi;
  let hero;
  while ((hero = heroPattern.exec(rendered))) {
    heroes.push({ name: textOf(hero[1]), percent: Number.parseInt(hero[2], 10) });
  }

  // Onderverdeling van het hoofdingredient (bijv. Lam 70%, Lamsbot 20%,
  // Lamsorganen 10%). Nodig om een heel dier te herkennen.
  const tiles = [];
  const tilePattern =
    /class="dc-otile-name"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,120}?class="dc-otile-pct"[^>]*>[\s\S]*?<b[^>]*>(\d+)<\/b>/gi;
  let tile;
  while ((tile = tilePattern.exec(rendered))) {
    tiles.push({ name: textOf(tile[1]), percent: Number.parseInt(tile[2], 10) });
  }

  const analysis = {};
  const rowPattern = /<div[^>]*class="dc-arow"[^>]*>([\s\S]*?)<\/div>/gi;
  let row;
  while ((row = rowPattern.exec(rendered))) {
    const label = field(row[1], "dc-alabel");
    const value = field(row[1], "dc-aval-main");
    if (label && value) analysis[label] = value.replace(/\s+/g, "");
  }

  return {
    title,
    description: meta ? decode(meta[1]).trim() : "",
    priceCents: price ? parsePrice(textOf(price[1])) : null,
    ingredients: ingredientsBlock ? textOf(ingredientsBlock[1]) : "",
    composition: [...heroes, ...tiles],
    analysis: normaliseAnalysis(analysis),
  };
}

/**
 * Vult de energie aan waar de fabrikant er geen publiceert en zet de herkomst
 * erbij: `opgave` als de pagina zelf een energiewaarde noemt, `schatting` als
 * die uit de analyse is teruggerekend. Een opgave wordt nooit overschreven.
 */
function applyEnergy(product) {
  product.analysis = normaliseAnalysis(product.analysis);
  if (typeof product.analysis.energieKcalPer100g === "number") {
    product.energieBron = "opgave";
    return;
  }
  const estimate = estimateEnergy(product.analysis);
  if (estimate !== null) {
    product.analysis.energieKcalPer100g = estimate;
    product.energieBron = "schatting";
  } else {
    delete product.energieBron;
  }
}

async function loadDetail(product) {
  const cacheFile = detailCacheFile(product.slug);
  if (!REFRESH && fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } catch {
      // kapotte cache opnieuw ophalen
    }
  }
  const { status, html } = await fetchText(product.url);
  const detail =
    status === 404
      ? { missing: true }
      : { missing: false, ...parseDetail(html) };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, `${JSON.stringify(detail, null, 2)}\n`);
  return detail;
}

function applyDetail(product, detail) {
  if (detail.missing) {
    product.available = false;
    return;
  }

  product.description = detail.description;
  product.analysis = normaliseAnalysis(detail.analysis);
  product.ingredients = detail.ingredients;
  product.composition = detail.composition;

  if (!product.priceCents && detail.priceCents) product.priceCents = detail.priceCents;
  if (!product.weightG && detail.title) product.weightG = parseWeight(detail.title);

  const name = product.name;
  const loosePart = loosePartOf(name);
  const completeName = COMPLETE.test(name);

  // Heel dier: ALRODA Puur <dier>, inclusief Vleesworst en Compleet. De
  // detailpagina bevestigt een enkel dier (100%, of 70% vlees met bot en
  // orgaan uit hetzelfde dier). Losse delen (Pens, Hart, Lever, Karkas)
  // vallen af via loosePartOf.
  product.wholeAnimal =
    isWholeAnimalCandidate(product.brand, name) && !loosePart && !FISH.test(name);

  if (product.wholeAnimal) {
    product.part = "heel";
    return;
  }

  // DARF en MEAT4DOGS verkopen kant-en-klare maaltijden (KVV/Compleet/Classic),
  // ook als de naam één dier of één vis noemt. Die gebruiken we nooit als
  // vervanging van de berekende samenstelling.
  if (product.brand === "DARF" || product.brand === "MEAT4DOGS") {
    product.part = "compleet";
    return;
  }

  if (loosePart) {
    product.part = loosePart;
    return;
  }

  if (completeName || detail.composition.length > 1) {
    product.part = "compleet";
    return;
  }

  product.part = FISH.test(name) ? "vis" : "spier";
}

function summarize(products) {
  const counts = {};
  for (const product of products) {
    counts[product.part] = (counts[product.part] ?? 0) + 1;
  }
  console.log(`\n${products.length} unieke producten.`);
  console.log("Per deel:", counts);
  console.log("Heel dier:", products.filter((product) => product.wholeAnimal).length);
  console.log("Niet leverbaar:", products.filter((product) => !product.available).length);
  console.log("Zonder prijs:", products.filter((product) => !product.priceCents).length);
  console.log("Zonder gewicht:", products.filter((product) => !product.weightG).length);

  for (const brand of ["ALRODA", "BARF", "DARF", "MEAT4DOGS"]) {
    const list = products.filter(
      (product) => product.available && product.wholeAnimal === (brand === "ALRODA") && product.brand === brand,
    );
    if (list.length === 0) continue;
    console.log(`\n${brand}:`);
    for (const product of list) {
      console.log(
        `  ${product.part.padEnd(8)} ${(product.flavor || "-").padEnd(7)} ${String(product.weightG).padStart(5)} g  €${(
          (product.priceCents ?? 0) / 100
        ).toFixed(2).padStart(6)}  ${product.name}`,
      );
    }
  }
}

function upsert(products) {
  const dbFile = path.join(process.cwd(), ".data", "oervoer.db");
  if (!fs.existsSync(dbFile)) {
    console.error(`Database niet gevonden: ${dbFile}`);
    console.error("Start de app één keer, of maak de database aan met de seed.");
    process.exitCode = 1;
    return;
  }
  const db = new DatabaseSync(dbFile);
  try {
    // Afgeleide tabel: veilig om opnieuw op te bouwen.
    db.exec(`
      DROP TABLE IF EXISTS shop_products;
      CREATE TABLE shop_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL,
        weight_g INTEGER,
        price_cents INTEGER,
        animal TEXT NOT NULL DEFAULT 'BEIDE',
        flavor TEXT NOT NULL DEFAULT '',
        part TEXT NOT NULL DEFAULT 'spier',
        whole_animal INTEGER NOT NULL DEFAULT 0,
        available INTEGER NOT NULL DEFAULT 1,
        ingredients TEXT NOT NULL DEFAULT '',
        composition TEXT NOT NULL DEFAULT '[]',
        analysis TEXT NOT NULL DEFAULT '{}',
        description TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_shop_products_part ON shop_products(part, flavor);
    `);

    const statement = db.prepare(`
      INSERT INTO shop_products
        (slug, name, brand, url, weight_g, price_cents, animal, flavor, part,
         whole_animal, available, ingredients, composition, analysis, description, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const product of products) {
      statement.run(
        product.slug,
        product.name,
        product.brand,
        product.url,
        product.weightG,
        product.priceCents,
        product.animal,
        product.flavor,
        product.part,
        product.wholeAnimal ? 1 : 0,
        product.available ? 1 : 0,
        product.ingredients,
        JSON.stringify(product.composition),
        JSON.stringify(product.analysis),
        product.description,
        now,
      );
    }
  } finally {
    db.close();
  }
}

if (NORMALISE_ONLY) {
  // Migratiepad: de bestaande snapshot gelijktrekken en van energie voorzien,
  // zonder netwerk.
  const snapshotPath = path.join(process.cwd(), "data", "darf-products.json");
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  for (const product of snapshot) {
    applyEnergy(product);
    if (!product.part) product.part = "onbekend";
  }
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const metOpgave = snapshot.filter((product) => product.energieBron === "opgave").length;
  const metSchatting = snapshot.filter((product) => product.energieBron === "schatting").length;
  const zonder = snapshot.length - metOpgave - metSchatting;
  console.log(
    `snapshot genormaliseerd: ${snapshot.length} producten, energie uit opgave ${metOpgave}, geschat ${metSchatting}, onbekend ${zonder}`,
  );
  process.exit(0);
}

const products = await scrapeCards();

if (!NO_DETAILS) {
  let index = 0;
  async function worker() {
    while (index < products.length) {
      const current = products[index];
      index += 1;
      if (!current.available) continue;
      const detail = await loadDetail(current);
      applyDetail(current, detail);
      process.stdout.write(".");
    }
  }
  await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));
  process.stdout.write("\n");
} else {
  for (const product of products) {
    const loosePart = loosePartOf(product.name);
    const wholeAnimal =
      isWholeAnimalCandidate(product.brand, product.name) &&
      !loosePart &&
      !FISH.test(product.name);
    product.wholeAnimal = wholeAnimal;
    if (wholeAnimal) {
      product.part = "heel";
    } else if (product.brand === "DARF" || product.brand === "MEAT4DOGS") {
      product.part = "compleet";
    } else if (loosePart) {
      product.part = loosePart;
    } else {
      product.part = "onbekend";
    }
  }
}

products.sort((a, b) => a.name.localeCompare(b.name, "nl"));
for (const product of products) {
  if (!product.part) product.part = "onbekend";
  applyEnergy(product);
}

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, "darf-products.json"),
  `${JSON.stringify(products, null, 2)}\n`,
);

upsert(products);
summarize(products);
