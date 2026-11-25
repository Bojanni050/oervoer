/**
 * Boodschappenlijst bij een advies. De verhoudingen komen uit de berekening;
 * hier worden ze vertaald naar concrete ingredienten die je bij de supermarkt,
 * slager, visboer of online kunt kopen.
 */
import { PROTEINS, type CompositionPart } from "./advice";
import type { AdviceRecord } from "./types";

export type StoreKind = "Supermarkt" | "Slager" | "Visboer" | "Online";

export interface ShopProduct {
  name: string;
  store: StoreKind;
  note?: string;
}

export interface ShoppingLine {
  key: string;
  label: string;
  partLabel: string;
  grams: number;
  products: ShopProduct[];
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

/**
 * Verdeelt de grammen per samenstellingsdeel over de opgegeven smaken. Zonder
 * smaakvoorkeur wordt een kleine, gangbare mix gebruikt.
 */
const DEFAULT_MEATS = ["KIP", "RUND", "LAM", "EEND"];

function defaultMeatChoices(donts: string[]): string[] {
  const blocked = new Set(donts.map((value) => value.toUpperCase()));
  const common = DEFAULT_MEATS.filter((meat) => !blocked.has(meat));
  if (common.length >= 3) return common;

  const extra = Object.keys(CATALOG).filter(
    (meat) => !blocked.has(meat) && !common.includes(meat) && meatLikes([meat]).length > 0,
  );
  return [...common, ...extra].slice(0, 4);
}

export function shoppingListFor(
  advice: Pick<AdviceRecord, "likes" | "donts" | "ras">,
  composition: CompositionPart[],
): ShoppingLine[] {
  const likes = advice.likes.filter(
    (like) => !advice.donts.some((dont) => dont.toUpperCase() === like.toUpperCase()),
  );
  const preferred = meatLikes(likes);
  const meatChoices = preferred.length > 0 ? preferred : defaultMeatChoices(advice.donts);
  const lines: ShoppingLine[] = [];

  for (const part of composition) {
    if (part.key === "vis") {
      lines.push({
        key: "vis",
        label: "Vis",
        partLabel: part.label,
        grams: part.grams,
        products: visProducts(likes),
      });
      continue;
    }

    if (part.key === "pens") {
      lines.push({
        key: "pens",
        label: "Pens",
        partLabel: part.label,
        grams: part.grams,
        products: [
          { name: "Pens", store: "Slager" },
          { name: "Pens (diepvries)", store: "Online" },
        ],
      });
      continue;
    }

    const partKey = part.key as PartKey;
    const available = meatChoices.filter((protein) => (CATALOG[protein]?.[partKey]?.length ?? 0) > 0);
    const choices = available.length > 0 ? available : ["KIP"];
    const amounts = splitGrams(part.grams, choices.length);

    choices.forEach((protein, index) => {
      lines.push({
        key: `${part.key}-${protein.toLowerCase()}`,
        label: lineLabel(protein, partKey),
        partLabel: part.label,
        grams: amounts[index],
        products:
          partKey === "orgaan" && (CATALOG[protein]?.[partKey]?.length ?? 0) === 0
            ? genericOrganProducts()
            : (CATALOG[protein]?.[partKey] ?? []),
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
