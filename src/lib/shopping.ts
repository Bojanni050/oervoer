/**
 * Boodschappenlijst bij een advies. De verhoudingen komen uit de berekening;
 * hier worden ze vertaald naar concrete producten. Eerst een passend
 * DARF-product, met de generieke ingredientenlijst als fallback.
 */
import { PROTEINS, type CompositionPart } from "./advice";
import {
  boneFor,
  darfMinerals,
  fishFor,
  organFor,
  pensFor,
  wholeAnimalFor,
  type DarfProduct,
} from "./darf";
import {
  partMinerals,
  summariseMinerals,
  type MineralBand,
  type MineralReport,
  type MineralValues,
} from "./minerals";
import type { AdviceRecord } from "./types";

export type StoreKind = "Supermarkt" | "Slager" | "Visboer" | "Online";

export interface ShopProduct {
  name: string;
  store: StoreKind;
  note?: string;
  url?: string;
  priceCents?: number;
  weightG?: number;
  /** Analyse van het product (g calcium/fosfor per 100 g), als die bekend is. */
  minerals?: MineralValues;
}

export interface ShoppingLine {
  key: string;
  label: string;
  partLabel: string;
  grams: number;
  products: ShopProduct[];
  /** Calcium en fosfor per 100 g van de voorgestelde producten. */
  minerals: MineralValues;
  /** Bijdrage van deze regel aan het calcium in het pakket. */
  calciumG: number;
}

type PartKey = "vis" | "pens" | "karkas" | "orgaan" | "spier" | "bot" | "gemalen";

const LABELS = Object.fromEntries(PROTEINS.map((protein) => [protein.value, protein.label]));

const CATALOG: Record<string, Partial<Record<PartKey, ShopProduct[]>>> = {
  KIP: {
    gemalen: [
      { name: "Gemalen kip", store: "Slager" },
      { name: "Gemalen kip (diepvries)", store: "Online" },
    ],
    karkas: [
      { name: "Kippennek", store: "Slager" },
      { name: "Kippenrug", store: "Slager" },
    ],
    spier: [
      { name: "Kipfilet", store: "Supermarkt" },
      { name: "Kippendij", store: "Supermarkt" },
    ],
    bot: [
      { name: "Kippenpoten", store: "Supermarkt" },
      { name: "Kippenvleugels", store: "Supermarkt" },
    ],
    orgaan: [
      { name: "Kippenlever", store: "Supermarkt" },
      { name: "Kippenhart", store: "Slager" },
    ],
  },
  RUND: {
    gemalen: [
      { name: "Gemalen rund", store: "Slager" },
      { name: "Gemalen rund (diepvries)", store: "Online" },
    ],
    karkas: [
      { name: "Runderschenkel", store: "Slager" },
      { name: "Runderkarkas", store: "Online" },
    ],
    spier: [
      { name: "Runderstoofvlees", store: "Supermarkt" },
      { name: "Riblappen", store: "Supermarkt" },
    ],
    bot: [
      { name: "Soepbotten", store: "Slager" },
      { name: "Runderbotten", store: "Slager" },
    ],
    orgaan: [
      { name: "Runderlever", store: "Supermarkt" },
      { name: "Runderhart", store: "Slager" },
    ],
  },
  LAM: {
    gemalen: [
      { name: "Gemalen lam", store: "Slager" },
      { name: "Gemalen lam (diepvries)", store: "Online" },
    ],
    karkas: [
      { name: "Lamsschenkel", store: "Slager" },
      { name: "Lamskarkas", store: "Online" },
    ],
    spier: [
      { name: "Lamsschouder", store: "Supermarkt" },
      { name: "Lamsbout", store: "Supermarkt" },
    ],
    bot: [{ name: "Lamsbotten", store: "Slager" }],
    orgaan: [
      { name: "Lamslever", store: "Slager" },
      { name: "Lamshart", store: "Slager" },
    ],
  },
  EEND: {
    gemalen: [{ name: "Gemalen eend (diepvries)", store: "Online" }],
    karkas: [{ name: "Eendenkarkas", store: "Online" }],
    spier: [{ name: "Eendenborst", store: "Supermarkt" }],
    bot: [{ name: "Eendenbotten", store: "Online" }],
    orgaan: [
      { name: "Eendenlever", store: "Online" },
      { name: "Eendenhart", store: "Online" },
    ],
  },
  ZALM: {},
  HERT: {
    gemalen: [{ name: "Gemalen hert (diepvries)", store: "Online" }],
    karkas: [{ name: "Hertenkarkas", store: "Online" }],
    spier: [
      { name: "Hertenbiefstuk", store: "Slager" },
      { name: "Hertenstoofvlees", store: "Online" },
    ],
    bot: [{ name: "Hertenbotten", store: "Online" }],
    orgaan: [{ name: "Hertenlever", store: "Online" }],
  },
  KONIJN: {
    gemalen: [{ name: "Gemalen konijn (diepvries)", store: "Online" }],
    karkas: [{ name: "Konijnenkarkas", store: "Online" }],
    spier: [{ name: "Konijnenbout", store: "Slager" }],
    bot: [{ name: "Konijnenbotten", store: "Online" }],
    orgaan: [{ name: "Konijnenlever", store: "Online" }],
  },
  GEIT: {
    gemalen: [{ name: "Gemalen geit (diepvries)", store: "Online" }],
    karkas: [{ name: "Geitenkarkas", store: "Online" }],
    spier: [{ name: "Geitenvlees", store: "Slager" }],
    bot: [{ name: "Geitenbotten", store: "Online" }],
    orgaan: [{ name: "Geitenlever", store: "Online" }],
  },
  PAARD: {
    gemalen: [{ name: "Gemalen paard (diepvries)", store: "Online" }],
    karkas: [{ name: "Paardenkarkas", store: "Online" }],
    spier: [{ name: "Paardenbiefstuk", store: "Slager" }],
    bot: [{ name: "Paardenbotten", store: "Online" }],
    orgaan: [{ name: "Paardenlever", store: "Online" }],
  },
};

const MEAT_PARTS: PartKey[] = ["karkas", "orgaan", "spier", "bot", "gemalen"];

function meatLikes(likes: string[]): string[] {
  return likes.filter((like) => MEAT_PARTS.some((part) => CATALOG[like]?.[part]));
}

function splitGrams(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const values = Array.from({ length: count }, () => base);
  values[count - 1] += total - base * count;
  return values;
}

function lineLabel(protein: string, part: PartKey): string {
  const name = LABELS[protein] ?? protein;
  if (part === "gemalen") return `Gemalen ${name.toLowerCase()}`;
  if (part === "karkas") return `${name}karkas`;
  if (part === "orgaan") return `Orgaan van ${name.toLowerCase()}`;
  if (part === "spier") return `Spiervlees van ${name.toLowerCase()}`;
  return `Botten van ${name.toLowerCase()}`;
}

function visProducts(likes: string[]): ShopProduct[] {
  const products: ShopProduct[] = [];
  if (likes.includes("ZALM")) {
    products.push({ name: "Zalmkop of zalmkarkas", store: "Visboer" });
    products.push({ name: "Zalmfilet", store: "Supermarkt" });
  }
  products.push({ name: "Sardines (blik of diepvries)", store: "Supermarkt" });
  products.push({ name: "Makreel", store: "Supermarkt" });
  if (likes.includes("VIS")) products.push({ name: "Haring", store: "Supermarkt" });
  return products.slice(0, 3);
}

function genericOrganProducts(): ShopProduct[] {
  return [
    { name: "Orgaanmix", store: "Online" },
    { name: "Lever of hart", store: "Supermarkt" },
  ];
}

function fromDarf(product: DarfProduct, note?: string): ShopProduct {
  return {
    name: product.name,
    store: "Online",
    note,
    url: product.url,
    priceCents: product.priceCents ?? undefined,
    weightG: product.weightG ?? undefined,
    minerals: darfMinerals(product),
  };
}

/** Mineralen van een regel: die van het voorgestelde product, anders die van het deel. */
function lineMinerals(products: ShopProduct[], partKey: string): MineralValues {
  return products.find((product) => product.minerals)?.minerals ?? partMinerals(partKey);
}

function calciumGrams(grams: number, minerals: MineralValues): number {
  if (minerals.calcium === null) return 0;
  return Math.round(((grams * minerals.calcium) / 100) * 100) / 100;
}

/** Calcium en fosfor van de hele boodschappenlijst, getoetst aan de band. */
export function shoppingMineralReport(
  lines: ShoppingLine[],
  band: MineralBand,
): MineralReport {
  return summariseMinerals(
    lines.map((line) => ({ grams: line.grams, minerals: line.minerals })),
    band,
  );
}

function darfOrFallback(
  product: DarfProduct | undefined,
  fallback: ShopProduct[],
  note?: string,
): ShopProduct[] {
  return product ? [fromDarf(product, note)] : fallback;
}

/**
 * Verdeelt de grammen per samenstellingsdeel over de opgegeven smaken. Zonder
 * smaakvoorkeur wordt een kleine, gangbare mix gebruikt.
 */
const DEFAULT_MEATS = ["KIP", "RUND", "LAM", "EEND"];

/** Vier smaken per advies: genoeg variatie zonder de lijst te laten uitdijen. */
const MAX_MEAT_CHOICES = 4;
/** De gekozen smaak weegt twee keer zo zwaar: 40% van een deel bij vier smaken. */
const PREFERENCE_WEIGHT = 2;

function defaultMeatChoices(donts: string[]): string[] {
  const blocked = new Set(donts.map((value) => value.toUpperCase()));
  const common = DEFAULT_MEATS.filter((meat) => !blocked.has(meat));
  if (common.length >= 3) return common;

  const extra = Object.keys(CATALOG).filter(
    (meat) => !blocked.has(meat) && !common.includes(meat) && meatLikes([meat]).length > 0,
  );
  return [...common, ...extra].slice(0, 4);
}

/**
 * De aangevinkte smaken zijn een voorkeur, geen vervanging: zonder deze aanvulling
 * werd een advies met alleen "kip" ook echt alleen kip (karkas, orgaan, spier en
 * bot allemaal kip). De voorkeur komt vooraan en de standaardmix vult aan tot vier.
 */
function meatChoicesFor(
  likes: string[],
  donts: string[],
): { choices: string[]; preferred: string[] } {
  const preferred = meatLikes(likes);
  if (preferred.length === 0) return { choices: defaultMeatChoices(donts), preferred };
  const fillers = defaultMeatChoices(donts).filter((meat) => !preferred.includes(meat));
  const choices = [...preferred, ...fillers].slice(0, Math.max(MAX_MEAT_CHOICES, preferred.length));
  return { choices, preferred };
}

/** Verdeelt grammen naar gewicht in plaats van eerlijk: de voorkeur krijgt meer. */
function splitGramsWeighted(total: number, choices: string[], preferred: string[]): number[] {
  if (choices.length === 0) return [];
  const weights = choices.map((meat) => (preferred.includes(meat) ? PREFERENCE_WEIGHT : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map((weight) => Math.floor((total * weight) / sum));
  values[values.length - 1] += total - values.reduce((a, b) => a + b, 0);
  return values;
}

function flavorsForPart(part: PartKey, meatChoices: string[]): string[] {
  const available = meatChoices.filter((protein) => (CATALOG[protein]?.[part]?.length ?? 0) > 0);
  return available.length > 0 ? available : ["KIP"];
}

/**
 * Totale grams per smaak over de delen die door een heel-dierproduct worden
 * gedekt (gemalen, karkas en spier). Zo kiezen we één verpakking per smaak in
 * plaats van per regel een andere maat.
 */
function wholeAnimalTotals(
  composition: CompositionPart[],
  meatChoices: string[],
  preferred: string[],
): Map<string, number> {
  const totals = new Map<string, number>();
  const wholeParts: PartKey[] = ["gemalen", "karkas", "spier"];
  for (const part of composition) {
    const partKey = part.key as PartKey;
    if (!wholeParts.includes(partKey)) continue;
    const flavors = flavorsForPart(partKey, meatChoices);
    const amounts = splitGramsWeighted(part.grams, flavors, preferred);
    flavors.forEach((flavor, index) => {
      totals.set(flavor, (totals.get(flavor) ?? 0) + amounts[index]);
    });
  }
  return totals;
}

export function shoppingListFor(
  advice: Pick<AdviceRecord, "likes" | "donts" | "ras">,
  composition: CompositionPart[],
): ShoppingLine[] {
  const likes = advice.likes.filter(
    (like) => !advice.donts.some((dont) => dont.toUpperCase() === like.toUpperCase()),
  );
  const { choices: meatChoices, preferred } = meatChoicesFor(likes, advice.donts);
  const wholeTotals = wholeAnimalTotals(composition, meatChoices, preferred);
  const lines: ShoppingLine[] = [];

  for (const part of composition) {
    if (part.key === "vis") {
      const products = darfOrFallback(
        fishFor(likes, advice.donts.map((dont) => dont.toUpperCase())),
        visProducts(likes),
      );
      const minerals = lineMinerals(products, "vis");
      lines.push({
        key: "vis",
        label: "Vis",
        partLabel: part.label,
        grams: part.grams,
        products,
        minerals,
        calciumG: calciumGrams(part.grams, minerals),
      });
      continue;
    }

    if (part.key === "pens") {
      const products = darfOrFallback(
        pensFor(meatChoices, advice.donts.map((dont) => dont.toUpperCase())),
        [
          { name: "Pens", store: "Slager" },
          { name: "Pens (diepvries)", store: "Online" },
        ],
      );
      const minerals = lineMinerals(products, "pens");
      lines.push({
        key: "pens",
        label: "Pens",
        partLabel: part.label,
        grams: part.grams,
        products,
        minerals,
        calciumG: calciumGrams(part.grams, minerals),
      });
      continue;
    }

    const partKey = part.key as PartKey;
    const choices = flavorsForPart(partKey, meatChoices);
    const amounts = splitGramsWeighted(part.grams, choices, preferred);

    choices.forEach((protein, index) => {
      let products: ShopProduct[];
      if (partKey === "orgaan" || partKey === "bot") {
        const fallback =
          (CATALOG[protein]?.[partKey]?.length ?? 0) > 0
            ? (CATALOG[protein]?.[partKey] ?? [])
            : genericOrganProducts();
        const darf =
          partKey === "orgaan"
            ? organFor(protein, amounts[index])
            : boneFor(protein, amounts[index]);
        products = darfOrFallback(darf, fallback);
      } else {
        const fallback = CATALOG[protein]?.[partKey] ?? [];
        const darf = wholeAnimalFor(protein, wholeTotals.get(protein) ?? amounts[index]);
        products = darfOrFallback(darf, fallback, "heel dier");
      }

      const minerals = lineMinerals(products, part.key);
      lines.push({
        key: `${part.key}-${protein.toLowerCase()}`,
        label: lineLabel(protein, partKey),
        partLabel: part.label,
        grams: amounts[index],
        products,
        minerals,
        calciumG: calciumGrams(amounts[index], minerals),
      });
    });
  }

  return lines;
}

export function storeSummary(lines: ShoppingLine[]): StoreKind[] {
  const order: StoreKind[] = ["Supermarkt", "Slager", "Visboer", "Online"];
  const used = new Set(lines.flatMap((line) => line.products.map((product) => product.store)));
  return order.filter((store) => used.has(store));
}

export function formatShopWeight(weightG: number): string {
  if (weightG >= 1000) {
    return `${(weightG / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} kg`;
  }
  return `${weightG} g`;
}

export function formatShopPrice(priceCents: number): string {
  return `€ ${(priceCents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
