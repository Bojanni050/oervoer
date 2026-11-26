/**
 * Calcium en fosfor in de berekeningen.
 *
 * Twee soorten bronnen, en dat verschil blijft zichtbaar in de uitkomst:
 *
 * - **De norm** (FEDIAF 2025): de band waarbinnen een compleet menu hoort te
 *   vallen. FEDIAF drukt calcium uit per 100 g droge stof en per 1000 kcal;
 *   rauw voer is ongeveer 30% droge stof, dus rekenen we om naar per 100 g voer.
 * - **De analyse per product**: het calcium- en fosforgehalte van het product
 *   zoals het verkocht wordt (g per 100 g). Voor DARF-producten komt dat uit de
 *   analyse in `data/darf-products.json`, voor eigen SKU's uit
 *   `data/product-nutrition.csv` (kolom `calcium`, `fosfor`).
 *
 * Waarom niet op botpercentage rekenen: mixen met hetzelfde botpercentage
 * verschillen tot drievoudig in gemeten calcium (kipnek 0,39% tegen lamsbot
 * 0,13%), omdat bot van oudere of zwaardere dieren meer calcium bevat en
 * kraakbeen vaak als "bot" wordt meegeteld. Bot is dus een ingrediënt, calcium
 * is de maat.
 */
import type { Dier } from "./types";

/** Rauw voer is ongeveer 70% vocht; FEDIAF-normen staan per 100 g droge stof. */
export const DRY_MATTER_SHARE = 0.3;

export type DietKey = "HOND" | "HOND_PUP" | "KAT" | "KAT_PUP";

export interface MineralBand {
  key: DietKey;
  label: string;
  /** FEDIAF-minimum in g calcium per 100 g droge stof. */
  calciumMinDm: number;
  /** FEDIAF-maximum in g calcium per 100 g droge stof (null = geen maximum). */
  calciumMaxDm: number | null;
  /** Dezelfde grens zoals FEDIAF hem zelf noemt, per 1000 kcal. */
  calciumMinPer1000Kcal: number;
  calciumMaxPer1000Kcal: number | null;
  /** Calcium/fosfor-verhouding, minimaal en (waar gesteld) maximaal. */
  caPMin: number;
  caPMax: number | null;
  source: string;
}

export const MINERAL_BANDS: Record<DietKey, MineralBand> = {
  HOND: {
    key: "HOND",
    label: "volwassen hond",
    calciumMinDm: 0.58,
    calciumMaxDm: 2.5,
    calciumMinPer1000Kcal: 1.45,
    calciumMaxPer1000Kcal: 6.25,
    caPMin: 1,
    caPMax: 2,
    source: "FEDIAF 2025, tabel III-3 (hond)",
  },
  HOND_PUP: {
    key: "HOND_PUP",
    label: "pup (vroege groei, < 14 weken)",
    calciumMinDm: 1,
    calciumMaxDm: 1.6,
    calciumMinPer1000Kcal: 2.5,
    calciumMaxPer1000Kcal: 4,
    caPMin: 1,
    caPMax: 1.8,
    source: "FEDIAF 2025, tabel III-3 (vroege groei)",
  },
  KAT: {
    key: "KAT",
    label: "volwassen kat",
    calciumMinDm: 0.53,
    calciumMaxDm: null,
    calciumMinPer1000Kcal: 1.33,
    calciumMaxPer1000Kcal: null,
    caPMin: 1,
    caPMax: 2,
    source: "FEDIAF 2025, tabel III-4 (kat)",
  },
  KAT_PUP: {
    key: "KAT_PUP",
    label: "kitten",
    calciumMinDm: 1,
    calciumMaxDm: null,
    calciumMinPer1000Kcal: 2.5,
    calciumMaxPer1000Kcal: null,
    caPMin: 1,
    caPMax: 1.8,
    source: "FEDIAF 2025, tabel III-4 (groei)",
  },
};

export function dietKeyFor(ras: Dier, pup: boolean): DietKey {
  if (ras === "KAT") return pup ? "KAT_PUP" : "KAT";
  return pup ? "HOND_PUP" : "HOND";
}

export function bandFor(ras: Dier, pup: boolean): MineralBand {
  return MINERAL_BANDS[dietKeyFor(ras, pup)];
}

export interface CalciumRange {
  min: number;
  max: number | null;
}

/** De band omgerekend naar g calcium per 100 g voer. */
export function calciumRangePer100g(band: MineralBand): CalciumRange {
  return {
    min: band.calciumMinDm * DRY_MATTER_SHARE,
    max: band.calciumMaxDm === null ? null : band.calciumMaxDm * DRY_MATTER_SHARE,
  };
}

export interface MineralValues {
  /** g calcium per 100 g product, null als het onbekend is. */
  calcium: number | null;
  /** g fosfor per 100 g product, null als het onbekend is. */
  fosfor: number | null;
  /** kcal per 100 g product, gebruikt voor de omrekening per 1000 kcal. */
  energie?: number | null;
  /** Herkomst van de energiewaarde: opgave van de fabrikant of teruggerekend. */
  energieBron?: "opgave" | "schatting";
}

/** Wat de DARF-analyse per product vastlegt, na het gelijktrekken van de labels. */
export type AnalysisKey =
  | "vocht"
  | "eiwit"
  | "vet"
  | "celstof"
  | "as"
  | "calcium"
  | "fosfor"
  | "energieKcalPer100g"
  | "caP";

/**
 * Terugvalwaarden per vleestype, in g per 100 g product. Het zijn de
 * gemiddelden van de DARF-analyses van de producten in dat deel (gemeten
 * uitersten tussen haakjes), zodat een eigen SKU zonder eigen analyse toch
 * meeweegt in plaats van als nul te tellen. Vul de eigen analyse in
 * `data/product-nutrition.csv` in om ze per product te vervangen.
 */
export const FALLBACK_MINERALS: Record<string, MineralValues> = {
  VIS: { calcium: 0.6, fosfor: 0.5, energie: 176 }, // 0,22 (filet) – 1,06 (kop)
  "GEMALEN VIS": { calcium: 0.6, fosfor: 0.5, energie: 176 },
  PENS: { calcium: 0.11, fosfor: 0.1, energie: 155 }, // 0,068 – 0,14
  SPIERVLEES: { calcium: 0.02, fosfor: 0.19, energie: 167 }, // spier zonder bot
  ORGAAN: { calcium: 0.13, fosfor: 0.15, energie: 140 }, // 0,01 (lever) – 0,34 (hart/maag)
  "ZACHT BOT": { calcium: 0.45, fosfor: 0.19, energie: 207 }, // gevogeltekarkas/nek, 0,39 – 0,49
  "MIDDEL BOT": { calcium: 0.85, fosfor: 0.45, energie: 180 }, // konijn, kwartel, gans: 0,49 – 1,30
  "HARD BOT": { calcium: 0.25, fosfor: 0.15, energie: 190 }, // lam/rund/geit: 0,13 – 0,35
  "COMPLEET KARKAS": { calcium: 0.84, fosfor: 0.4, energie: 168 },
  "COMPLEET KARKAS.ZACHT BOT": { calcium: 0.85, fosfor: 0.45, energie: 180 },
  "COMPLEET KARKAS.MIDDEL BOT": { calcium: 0.85, fosfor: 0.45, energie: 180 },
  "COMPLEET KARKAS.HARD BOT": { calcium: 0.5, fosfor: 0.25, energie: 190 },
  "COMPLEET GEMALEN": { calcium: 0.79, fosfor: 0.55, energie: 185 }, // heel dier met bot: 0,32 – 1,41
};

function normalizeType(typeVlees: string): string {
  return typeVlees.trim().replace(/\s+/g, " ").toUpperCase();
}

export function fallbackMinerals(typeVlees: string): MineralValues | null {
  return FALLBACK_MINERALS[normalizeType(typeVlees)] ?? null;
}

/**
 * Terugvalwaarden per samenstellingsdeel van het advies. Dezelfde herkomst als
 * hierboven, maar gegroepeerd zoals `compositionFor()` de delen kent.
 */
export const PART_MINERALS: Record<string, MineralValues> = {
  vis: { calcium: 0.6, fosfor: 0.5, energie: 176 },
  pens: { calcium: 0.11, fosfor: 0.1, energie: 155 },
  karkas: { calcium: 0.84, fosfor: 0.4, energie: 168 },
  orgaan: { calcium: 0.13, fosfor: 0.15, energie: 140 },
  spier: { calcium: 0.02, fosfor: 0.19, energie: 167 },
  bot: { calcium: 0.27, fosfor: 0.16, energie: 207 }, // gemiddelde van de losse botproducten
  gemalen: { calcium: 0.79, fosfor: 0.55, energie: 185 },
};

export function partMinerals(partKey: string): MineralValues {
  return PART_MINERALS[partKey] ?? { calcium: null, fosfor: null };
}

/**
 * Calcium en fosfor van een product: de eigen analyse als die er is, anders de
 * terugvalwaarde van het vleestype. Zo valt een menu nooit stil op nul terug.
 */
export function productMinerals(product: {
  typeVlees: string;
  calcium?: number | null;
  fosfor?: number | null;
  energie?: number | null;
}): MineralValues {
  const fallback = fallbackMinerals(product.typeVlees);
  return {
    calcium: product.calcium ?? fallback?.calcium ?? null,
    fosfor: product.fosfor ?? fallback?.fosfor ?? null,
    energie: product.energie ?? fallback?.energie ?? null,
    energieBron: "opgave",
  };
}

export interface MineralInput {
  grams: number;
  minerals: MineralValues;
}

export type MineralStatus = "leeg" | "onbekend" | "laag" | "ok" | "hoog";

export interface MineralReport {
  /** Grammen die zijn meegewogen. */
  grams: number;
  /** Grammen waarvoor geen calciumgehalte bekend was (die tellen als 0). */
  unknownGrams: number;
  calciumG: number;
  fosforG: number;
  calciumPer100g: number;
  calciumPer1000Kcal: number | null;
  /** kcal per 100 g voer, als die voor alle regels bekend is. */
  energiePer100g: number | null;
  /** "schatting" zodra één van de meegewogen energiewaarden is teruggerekend. */
  energieBron: "opgave" | "schatting" | null;
  caP: number | null;
  status: MineralStatus;
  message: string;
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatMineral(value: number, digits = 2): string {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Korte aanduiding van de uitkomst, voor de compacte panelen. */
export function mineralStatusLabel(status: MineralStatus): string {
  switch (status) {
    case "laag":
      return "Onder de norm";
    case "hoog":
      return "Boven de norm";
    case "onbekend":
      return "Deels onbekend";
    case "leeg":
      return "Geen rantsoen";
    default:
      return "Binnen de norm";
  }
}

/**
 * Telt calcium en fosfor op over een set regels (picklijstregels, delen van het
 * advies of boodschappenlijstregels) en toetst het resultaat aan de band.
 */
export function summariseMinerals(items: MineralInput[], band: MineralBand): MineralReport {
  let grams = 0;
  let unknownGrams = 0;
  let calciumG = 0;
  let fosforG = 0;
  let fosforKnownGrams = 0;
  let energieKcal = 0;
  let energieKnownGrams = 0;
  let energieEstimated = false;

  for (const item of items) {
    const itemGrams = Math.max(0, item.grams);
    grams += itemGrams;
    if (item.minerals.calcium === null) unknownGrams += itemGrams;
    else calciumG += (itemGrams * item.minerals.calcium) / 100;
    if (item.minerals.fosfor === null) {
      // geen fosfor bekend: verhouding niet zinvol over de hele set
    } else {
      fosforG += (itemGrams * item.minerals.fosfor) / 100;
      fosforKnownGrams += itemGrams;
    }
    if (item.minerals.energie !== undefined && item.minerals.energie !== null) {
      energieKcal += (itemGrams * item.minerals.energie) / 100;
      energieKnownGrams += itemGrams;
      if (item.minerals.energieBron === "schatting") energieEstimated = true;
    }
  }

  const calciumPer100g = grams > 0 ? (calciumG / grams) * 100 : 0;
  const completeEnergie = grams > 0 && energieKnownGrams === grams;
  const calciumPer1000Kcal = completeEnergie && energieKcal > 0 ? (calciumG / energieKcal) * 1000 : null;
  const energiePer100g = completeEnergie && energieKcal > 0 ? (energieKcal / grams) * 100 : null;
  const energieBron: MineralReport["energieBron"] = !completeEnergie
    ? null
    : energieEstimated
      ? "schatting"
      : "opgave";
  const completeFosfor = grams > 0 && fosforKnownGrams === grams && fosforG > 0;
  const caP = completeFosfor ? calciumG / fosforG : null;
  const range = calciumRangePer100g(band);

  let status: MineralStatus = "ok";
  if (grams <= 0) status = "leeg";
  else if (unknownGrams > grams * 0.1) status = "onbekend";
  else if (calciumPer100g < range.min) status = "laag";
  else if (range.max !== null && calciumPer100g > range.max) status = "hoog";

  const rangeText =
    range.max === null
      ? `${formatMineral(range.min)} g of hoger`
      : `${formatMineral(range.min)} – ${formatMineral(range.max)} g`;
  const basis = `${formatMineral(calciumPer100g)} g calcium per 100 g voer (${band.label}: ${rangeText}, ${band.source})`;

  let message: string;
  if (status === "leeg") {
    message = "Geen gewicht om te rekenen.";
  } else if (status === "onbekend") {
    message = `Calcium onbekend voor ${Math.round(unknownGrams)} van ${Math.round(grams)} g; ${basis}.`;
  } else if (status === "laag") {
    message = `Onder de norm: ${basis}. Meer calciumrijke botten (kipnek, kippenvleugel) of los calcium toevoegen.`;
  } else if (status === "hoog") {
    message = `Boven de norm: ${basis}. Minder bot of calciumarmere botten (lamsbot, rundbot) gebruiken.`;
  } else {
    message = `Binnen de norm: ${basis}.`;
  }

  if ((status === "ok" || status === "laag" || status === "hoog") && band.caPMin > 0 && caP !== null) {
    if (caP < band.caPMin) message += " Let op de calcium/fosfor-verhouding: die is aan de lage kant.";
    else if (band.caPMax !== null && caP > band.caPMax) {
      message += " Let op de calcium/fosfor-verhouding: die is aan de hoge kant.";
    }
  }

  return {
    grams: round(grams, 1),
    unknownGrams: round(unknownGrams, 1),
    calciumG: round(calciumG, 2),
    fosforG: round(fosforG, 2),
    calciumPer100g: round(calciumPer100g, 3),
    calciumPer1000Kcal: calciumPer1000Kcal === null ? null : round(calciumPer1000Kcal, 2),
    energiePer100g: energiePer100g === null ? null : round(energiePer100g, 1),
    energieBron,
    caP: caP === null ? null : round(caP, 2),
    status,
    message,
  };
}
