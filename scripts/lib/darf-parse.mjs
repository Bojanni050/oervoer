/**
 * Leest de DARF-productpagina's (darf.nl) en zet ze om naar één productvorm.
 *
 * Waarom een aparte module: de catalogus-scanner (scripts/catalog-scan.mjs) en
 * de bestaande import (scripts/import-darf.mjs) moeten dezelfde waarheid
 * gebruiken. De pagina's zijn Angular-SSR met een handvol klassen; daar lezen we
 * op in plaats van op de volledige HTML-structuur, zodat een cosmetische
 * wijziging niet meteen alles breekt.
 */
import * as cheerio from "cheerio";

export const DARF_BASE = "https://darf.nl";

/** Beleefde user-agent met herkenbare herkomst, geen browser-vermomming. */
export const HEADERS = {
  "user-agent": "OerVoer-catalogus/1.0 (+https://oer.studiovanderheide.nl)",
  "accept-language": "nl-NL,nl;q=0.9",
};

/** Alle dieren die als smaak in een productnaam kunnen voorkomen. */
export const FLAVORS = [
  "KIP", "RUND", "LAM", "EEND", "ZALM", "HERT", "KONIJN", "GEIT", "PAARD",
  "GANS", "DUIF", "KALKOEN", "KALF", "ELAND", "FAZANT", "REE", "KWARTEL",
  "PARELHOEN", "PATRIJS", "SCHAAP", "VARKEN", "HARING", "MAKREEL", "SPROT",
  "SARDINE", "KABELJAUW", "HEEK", "KOOLVIS", "POON", "SCHELVIS",
];

export const BRANDS = ["ALRODA", "BARF", "DARF", "MEAT4DOGS", "PETT", "FELICHEF", "OERVOER"];

const ORGAN = /(lever|hart|long|nier|maag|boekmaag|organen|orgaan|testikel|zwezerik|klier|milt|alvleesklier)/i;
const PENS = /pens/i;
const BONE = /(botten?|bot|karkas|kraakbeen|nek|nekken|rug|kop|koppen|poot|poten|rib|ribben|sparerib|vleugel|vleugelpunt)/i;
const MUSCLE = /(spier|filet|vlees|blokjes|biefstuk|stoofvlees|bout|schouder|dij|borst|worst|gehakt|gemalen)/i;
const FISH = /(vis|zalm|haring|makreel|kabeljauw|heek|koolvis|poon|schelvis|sprot|sardine|forel|wijting)/i;
const COMPLETE = /(kvv|classic|compleet|actief|puppy|\bpup\b|small|all in one|groente|worstjes|noordzee|\b10 x\b)/i;

export function decode(text) {
  return String(text ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&euro;/g, "€")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Tekst met spaties tussen elementen, zodat "Duif: 70% vlees" leesbaar blijft. */
export function textOf($el) {
  const html = typeof $el === "string" ? $el : ($el?.html?.() ?? "");
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseWeight(text) {
  // Multipacks: "10 x 1 kg", "6 x 500 g".
  const multi = String(text ?? "").match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  if (multi) {
    const count = Number.parseInt(multi[1], 10);
    const each = Number.parseFloat(multi[2].replace(",", "."));
    return Math.round(count * each * (multi[3].toLowerCase() === "kg" ? 1000 : 1));
  }
  const match = String(text ?? "").match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Math.round(value * (match[2].toLowerCase() === "kg" ? 1000 : 1));
}

export function weightFromSlug(slug) {
  const value = String(slug);
  // "darf-actief-10-x-1-kg" is een multipack van 10 x 1 kg.
  const multi = value.match(/(\d+)-x-(\d+)(?:-(\d+))?-(kg|g)$/i);
  if (multi) {
    const count = Number.parseInt(multi[1], 10);
    const whole = Number.parseInt(multi[2], 10);
    const fraction = multi[3] ? Number.parseInt(multi[3], 10) : 0;
    const each = fraction ? whole + fraction / 10 ** String(multi[3]).length : whole;
    return Math.round(count * each * (multi[4].toLowerCase() === "kg" ? 1000 : 1));
  }
  const match = value.match(/(?:-|_)(\d+)(?:-(\d+))?-(kg|g)$/i) ?? value.match(/(\d+)(?:-(\d+))?-(kg|g)$/i);
  if (!match) return null;
  const whole = Number.parseInt(match[1], 10);
  const fraction = match[2] ? Number.parseInt(match[2], 10) : 0;
  const amount = fraction ? whole + fraction / 10 ** String(match[2]).length : whole;
  return Math.round(amount * (match[3].toLowerCase() === "kg" ? 1000 : 1));
}

export function parsePrice(text) {
  const match = String(text ?? "").match(/€\s*([\d.]+,\d{2})/);
  if (!match) return null;
  return Math.round(Number.parseFloat(match[1].replace(/\./g, "").replace(",", ".")) * 100);
}

export function classifyAnimal(text) {
  if (/\bkat\b|katten/i.test(text)) return "KAT";
  if (/\bhond\b|honden/i.test(text)) return "HOND";
  return "BEIDE";
}

export function classifyFlavor(text) {
  const upper = String(text ?? "").toUpperCase();
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
export function loosePartOf(rawName) {
  const name = String(rawName ?? "").replace(/vleesworst/gi, " ");
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

export function isWholeAnimalCandidate(brand, name) {
  if (brand !== "ALRODA") return false;
  if (!/\bPuur\b/i.test(name)) return false;
  // ALRODA Puur Pens/Hart/Lever/Long/Boekmaag zijn losse delen, geen heel dier.
  return loosePartOf(name.replace(/\bPuur\b/gi, "")) === "";
}

/**
 * De analyse gebruikt per product andere labels ("Ruw eiwit", "Ruw Eiwit",
 * "Ruwe eiwit", "Ruw eitwit", "Vezels", "Ruwe celstof", "Energie",
 * "Energie Kcal / 100g", "Clacium"). Zonder gelijktrekken verdwijnt meer dan de
 * helft van de waarden in losse sleutels.
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
  const key = String(label ?? "").toLowerCase().replace(/\s+/g, " ").trim();
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
 * eiwit, vet, celstof en as. Alleen als de fabrikant er geen publiceert; de
 * uitkomst wordt als schatting gemarkeerd. Op de 97 producten waar beide bekend
 * zijn wijkt dit gemiddeld 7,4% af van de opgave.
 */
export function estimateEnergy(analysis) {
  const { vocht, eiwit, vet, as } = analysis ?? {};
  const celstof = analysis?.celstof ?? 0;
  if ([vocht, eiwit, vet, as].some((value) => typeof value !== "number")) return null;
  const nfe = 100 - (vocht + eiwit + vet + celstof + as);
  if (nfe < 0) return null;
  return Math.round(4 * eiwit + 9 * vet + 4 * nfe);
}

/**
 * Vult de energie aan waar de fabrikant er geen publiceert en zet de herkomst
 * erbij: `opgave` als de pagina zelf een energiewaarde noemt, `schatting` als
 * die uit de analyse is teruggerekend. Een opgave wordt nooit overschreven.
 */
export function applyEnergy(product) {
  product.analysis = normaliseAnalysis(product.analysis);
  if (typeof product.analysis.energieKcalPer100g === "number") {
    product.energieBron = "opgave";
    return product;
  }
  const estimate = estimateEnergy(product.analysis);
  if (estimate !== null) {
    product.analysis.energieKcalPer100g = estimate;
    product.energieBron = "schatting";
  } else {
    delete product.energieBron;
  }
  return product;
}

/** Deel van het dier op basis van merk en naam (zelfde regels als de import). */
export function derivePart({ brand, name, compositionLength = 0 }) {
  const loosePart = loosePartOf(name);
  const completeName = COMPLETE.test(name);
  const wholeAnimal = isWholeAnimalCandidate(brand, name) && !loosePart && !FISH.test(name);

  if (wholeAnimal) return { part: "heel", wholeAnimal: true };
  // DARF en MEAT4DOGS verkopen kant-en-klare maaltijden (KVV/Compleet/Classic),
  // ook als de naam één dier of één vis noemt.
  if (brand === "DARF" || brand === "MEAT4DOGS") return { part: "compleet", wholeAnimal: false };
  if (loosePart) return { part: loosePart, wholeAnimal: false };
  if (completeName || compositionLength > 1) return { part: "compleet", wholeAnimal: false };
  return { part: FISH.test(name) ? "vis" : "spier", wholeAnimal: false };
}

/** Merk uit de titel of anders uit de slug. */
export function brandOf(title, slug) {
  const first = String(title ?? "").trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (BRANDS.includes(first)) return first;
  const prefix = String(slug ?? "").split("-")[0].toUpperCase();
  if (BRANDS.includes(prefix)) return prefix;
  return "";
}

/**
 * Leest één productpagina. Geeft alleen wat de pagina zelf zegt; de afleidingen
 * (deel, heel dier, energie) gebeuren in productFromDetail().
 */
export function parseDetail(html) {
  const $ = cheerio.load(html);

  const title = $(".pdp-title").first().text().replace(/\s+/g, " ").trim();
  const description = decode($('meta[name="description"]').attr("content") ?? "").trim();
  const priceCents = parsePrice($(".pdp-price").first().text());

  const ingredientsEl = $(".dc-fineprint").first();
  const ingredients = ingredientsEl.length ? textOf(ingredientsEl) : "";

  // Hero en tiles staan in documentvolgorde; naam en percentage horen bij
  // elkaar op diezelfde volgorde (zo deed de regex-parser het ook).
  const names = $(".dc-hero-name").map((_, el) => textOf($(el))).get();
  const percents = $(".dc-hero-pct")
    .map((_, el) => Number.parseInt(textOf($(el)).replace(/\D+/g, ""), 10))
    .get();
  const tileNames = $(".dc-otile-name").map((_, el) => textOf($(el))).get();
  const tilePercents = $(".dc-otile-pct")
    .map((_, el) => Number.parseInt(textOf($(el)).replace(/\D+/g, ""), 10))
    .get();

  const composition = [];
  names.forEach((name, index) => {
    if (name && Number.isFinite(percents[index])) composition.push({ name, percent: percents[index] });
  });
  tileNames.forEach((name, index) => {
    if (name && Number.isFinite(tilePercents[index])) composition.push({ name, percent: tilePercents[index] });
  });

  const raw = {};
  $(".dc-arow").each((_, row) => {
    const label = textOf($(row).find(".dc-alabel").first());
    const value = textOf($(row).find(".dc-aval-main").first()).replace(/\s+/g, "");
    if (label && value) raw[label] = value;
  });

  return {
    title,
    description,
    priceCents,
    ingredients,
    composition,
    analysis: normaliseAnalysis(raw),
  };
}

/** Volledig catalogusproduct uit slug + detailpagina. */
export function productFromDetail({ slug, url, detail }) {
  const brand = brandOf(detail.title, slug);
  const withoutWeight = detail.title.replace(/\s*\d+(?:[.,]\d+)?\s*(kg|g)\s*$/i, "").trim();
  const withoutBrand =
    brand && withoutWeight.toUpperCase().startsWith(brand)
      ? withoutWeight.slice(brand.length).trim()
      : withoutWeight;
  const name = (brand ? `${brand} ${withoutBrand}` : withoutWeight).replace(/\s+/g, " ").trim();
  const weightG = parseWeight(detail.title) ?? weightFromSlug(slug);
  const { part, wholeAnimal } = derivePart({
    brand,
    name,
    compositionLength: detail.composition?.length ?? 0,
  });

  const product = {
    slug,
    url,
    name,
    brand,
    weightG,
    priceCents: detail.priceCents,
    animal: classifyAnimal(name),
    flavor: classifyFlavor(name),
    part,
    wholeAnimal,
    ingredients: detail.ingredients ?? "",
    composition: detail.composition ?? [],
    description: detail.description ?? "",
    analysis: detail.analysis ?? {},
  };
  applyEnergy(product);
  return product;
}
