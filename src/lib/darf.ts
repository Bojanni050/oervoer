/**
 * DARF Versvoer-producten als concrete invulling van de boodschappenlijst.
 *
 * De snapshot komt uit `scripts/import-darf.mjs` (data/darf-products.json).
 * `wholeAnimal` betekent: een ALRODA Puur-product van één dier, inclusief
 * karkas, spier en orgaan. Dat is de smaakbasis voor de delen gemalen, karkas
 * en spier. Losse delen (pens, lever/hart, bot, vis) komen uit de BARF- en
 * ALRODA-losse-delenlijn. Complete KVV-maaltijden (DARF, MEAT4DOGS) doen nooit
 * mee: die zouden de berekende samenstelling vervangen in plaats van aanvullen.
 */
import rawProducts from "../../data/darf-products.json";
import type { AnalysisKey, MineralValues } from "./minerals";

export interface DarfProduct {
  slug: string;
  url: string;
  name: string;
  brand: string;
  weightG: number | null;
  priceCents: number | null;
  animal: "KAT" | "HOND" | "BEIDE";
  flavor: string;
  part: string;
  wholeAnimal: boolean;
  available: boolean;
  ingredients: string;
  composition: Array<{ name: string; percent: number }>;
  description: string;
  /** Analyse per 100 g product; de labels zijn gelijkgetrokken (zie import-darf.mjs). */
  analysis: Partial<Record<AnalysisKey, number>>;
  /** Herkomst van de energiewaarde: opgave van de fabrikant of teruggerekend. */
  energieBron?: "opgave" | "schatting";
}

const PRODUCTS = rawProducts as unknown as DarfProduct[];

export const DARF_PRODUCTS: DarfProduct[] = PRODUCTS.filter(
  (product) => product.available && product.weightG && product.priceCents,
);

function byWeight(product: DarfProduct): number {
  return product.weightG ?? 0;
}

function pickPack(candidates: DarfProduct[], grams: number): DarfProduct | undefined {
  if (candidates.length === 0) return undefined;
  // De volgorde van de kandidaten is de voorkeursvolgorde (orgaan: lever vóór
  // hart, bot: nek vóór vleugel). Binnen die volgorde kiezen we de grootste
  // verpakking die past, anders de kleinste.
  const fitting = candidates.filter((product) => byWeight(product) <= grams);
  if (fitting.length > 0) {
    const largest = Math.max(...fitting.map(byWeight));
    return fitting.find((product) => byWeight(product) === largest);
  }
  const smallest = Math.min(...candidates.map(byWeight));
  return candidates.find((product) => byWeight(product) === smallest);
}

/** Leest een analysewaarde uit de DARF-analyse; null als die ontbreekt. */
export function analysisNumber(product: DarfProduct, key: AnalysisKey): number | null {
  const raw = product.analysis?.[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/**
 * De analyse van een DARF-product als mineralen, in g (en kcal) per 100 g
 * product. `energieBron` vertelt of de energiewaarde van de fabrikant komt of
 * uit de analyse is teruggerekend.
 */
export function darfMinerals(product: DarfProduct): MineralValues {
  const energie = analysisNumber(product, "energieKcalPer100g");
  const calcium = analysisNumber(product, "calcium");
  return {
    calcium,
    fosfor: analysisNumber(product, "fosfor"),
    energie,
    energieBron:
      energie === null ? undefined : product.energieBron === "schatting" ? "schatting" : "opgave",
  };
}

/** Heel-dierproduct van dezelfde smaak, passend bij de totale grams. */
export function wholeAnimalFor(flavor: string, grams: number): DarfProduct | undefined {
  const candidates = DARF_PRODUCTS.filter(
    (product) => product.wholeAnimal && product.flavor === flavor,
  );
  return pickPack(candidates, grams);
}

const ORGAN_ORDER = [/lever/i, /hart/i, /long/i, /maag/i, /nier/i, /orgaan/i];

function organRank(product: DarfProduct): number {
  const index = ORGAN_ORDER.findIndex((pattern) => pattern.test(product.name));
  return index === -1 ? ORGAN_ORDER.length : index;
}

/** Echt los orgaan van dezelfde smaak (lever, hart, long of maag). */
export function organFor(flavor: string, grams: number): DarfProduct | undefined {
  const candidates = DARF_PRODUCTS.filter(
    (product) => product.part === "orgaan" && product.flavor === flavor,
  ).sort((a, b) => organRank(a) - organRank(b) || a.name.localeCompare(b.name, "nl"));
  return pickPack(candidates, grams);
}

const BONE_ORDER = [/nek/i, /kop/i, /bot/i, /rib/i, /poot/i, /vleugel/i];

function boneRank(product: DarfProduct): number {
  const index = BONE_ORDER.findIndex((pattern) => pattern.test(product.name));
  return index === -1 ? BONE_ORDER.length : index;
}

/** Echt los bot van dezelfde smaak (nek, kop, rib of poot). */
export function boneFor(flavor: string, grams: number): DarfProduct | undefined {
  const candidates = DARF_PRODUCTS.filter(
    (product) => product.part === "bot" && product.flavor === flavor,
  ).sort((a, b) => boneRank(a) - boneRank(b) || a.name.localeCompare(b.name, "nl"));
  return pickPack(candidates, grams);
}

/**
 * Pens uit de voorkeurssmaken. Runderpens is de veilige standaard als geen van
 * de gekozen smaken een pensproduct heeft.
 */
export function pensFor(
  preferredFlavors: string[],
  avoidFlavors: string[] = [],
): DarfProduct | undefined {
  const avoided = new Set(avoidFlavors);
  const pens = DARF_PRODUCTS.filter(
    (product) => product.part === "pens" && !avoided.has(product.flavor),
  );
  for (const flavor of preferredFlavors) {
    const match = pens.find((product) => product.flavor === flavor);
    if (match) return match;
  }
  return pens.find((product) => product.flavor === "RUND") ?? pens[0];
}

const FISH_ORDER = [/haring/i, /kabeljauw/i, /koolvis/i, /heek/i, /poon/i, /schelvis/i, /zalm/i];

/**
 * Vis uit de voorkeurssmaken. Zalm heeft de voorkeur als de bezoeker dat koos;
 * anders een gangbare hele vis. Viskop en vislijf zijn bruikbaar, maar een
 * hele vis staat vooraan.
 */
export function fishFor(
  preferredFlavors: string[],
  avoidFlavors: string[] = [],
): DarfProduct | undefined {
  const avoided = new Set(avoidFlavors);
  const fish = DARF_PRODUCTS.filter(
    (product) => product.part === "vis" && !avoided.has(product.flavor),
  );
  const wholeFish = fish.filter((product) => /ALRODA Puur/i.test(product.name));
  const pool = wholeFish.length > 0 ? wholeFish : fish;
  if (preferredFlavors.includes("ZALM")) {
    const salmon = pool.find((product) => /zalm/i.test(product.name));
    if (salmon) return salmon;
  }
  const sorted = [...pool].sort((a, b) => {
    const rankA = FISH_ORDER.findIndex((pattern) => pattern.test(a.name));
    const rankB = FISH_ORDER.findIndex((pattern) => pattern.test(b.name));
    return (rankA === -1 ? FISH_ORDER.length : rankA) - (rankB === -1 ? FISH_ORDER.length : rankB);
  });
  return sorted[0];
}
