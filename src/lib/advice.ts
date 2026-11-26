/**
 * Voedingsadvies: dezelfde rekenregels als de picklist-wizard, maar zonder
 * concrete producten. Het advies bestaat uit grammen per dag, een verdeling
 * over maaltijden en de samenstelling van het gekozen pakket.
 */
import { CAT_FACTOR, DOG_FACTOR } from "./globals";
import {
  bandFor,
  calciumRangePer100g,
  partMinerals,
  summariseMinerals,
  type MineralBand,
  type MineralReport,
} from "./minerals";
import type { Dier, PackageKind, Portie } from "./types";

export const PACKAGE_SIZES = [5, 10, 15, 20] as const;

export const PROTEINS: Array<{ value: string; label: string }> = [
  { value: "KIP", label: "Kip" },
  { value: "RUND", label: "Rund" },
  { value: "LAM", label: "Lam" },
  { value: "EEND", label: "Eend" },
  { value: "ZALM", label: "Zalm" },
  { value: "VIS", label: "Vis (alle soorten)" },
  { value: "HERT", label: "Hert" },
  { value: "KONIJN", label: "Konijn" },
  { value: "GEIT", label: "Geit" },
  { value: "PAARD", label: "Paard" },
  { value: "PENS", label: "Pens" },
  { value: "ORGAAN", label: "Orgaan" },
];

export const ADVICE_STYLES: Record<PackageKind, { label: string; tagline: string; description: string; bestFor: string }> = {
  PLUS: {
    label: "Meer gemalen",
    tagline: "Zacht en makkelijk",
    description:
      "Een gemalen basis, aangevuld met vis en – voor honden – pens. Makkelijk te portioneren en zacht voor de tanden.",
    bestFor: "Katten, oudere honden of honden die moeite hebben met grote stukken.",
  },
  "100": {
    label: "Meer karkas",
    tagline: "Structuur en kauwwerk",
    description:
      "Meer karkas, bot en orgaan naast spiervlees. Een natuurlijker menu met meer textuur en kauwwerk.",
    bestFor: "Gezonde honden die graag kauwen. Katten krijgen de zachtere karkasvariant.",
  },
  COMBI: {
    label: "Van beide wat",
    tagline: "Afwisseling",
    description:
      "De helft meer gemalen, de helft meer karkas. Zo wisselt je dier tussen zacht en stevig voer.",
    bestFor: "Dieren die moeten wennen aan karkas of graag afwisseling hebben.",
  },
};

export const STYLE_ORDER: PackageKind[] = ["PLUS", "100", "COMBI"];

export interface AdviceInput {
  animal?: string;
  ras: Dier;
  weight: number;
  pup: boolean;
  portie: Portie;
  kind: PackageKind;
  packageKg: number;
  donts: string[];
  likes?: string[];
}

export interface CompositionPart {
  key: string;
  label: string;
  percent: number;
  grams: number;
}

export interface AdviceResult {
  dailyGrams: number;
  mealGrams: number;
  mealsPerDay: number;
  days: number;
  composition: CompositionPart[];
  notes: string[];
  warnings: string[];
}

const PART_LABELS: Record<string, string> = {
  vis: "Vis",
  pens: "Pens",
  karkas: "Karkas",
  orgaan: "Orgaan",
  spier: "Spiervlees",
  bot: "Bot",
  gemalen: "Gemalen vlees",
};

const PART_ORDER = ["vis", "pens", "karkas", "orgaan", "spier", "bot", "gemalen"];

export function weightFactorFor(ras: Dier): number {
  return ras === "KAT" ? CAT_FACTOR : DOG_FACTOR;
}

export function dailyGramsFor(ras: Dier, weight: number): number {
  return weight * weightFactorFor(ras) * 1000;
}

export function mealsPerDayFor(pup: boolean): number {
  return pup ? 3 : 2;
}

/** Kleinste pakket dat ongeveer vier weken meegaat. */
export function recommendedPackageKg(ras: Dier, weight: number): number {
  const daily = dailyGramsFor(ras, weight);
  const target = (daily * 28) / 1000;
  return PACKAGE_SIZES.find((size) => size >= target) ?? PACKAGE_SIZES[PACKAGE_SIZES.length - 1];
}

export function daysForPackage(ras: Dier, weight: number, packageKg: number): number {
  const daily = dailyGramsFor(ras, weight);
  if (daily <= 0) return 0;
  return Math.round((packageKg * 1000) / daily);
}

type Fractions = Record<string, number>;

function emptyFractions(): Fractions {
  return PART_ORDER.reduce<Fractions>((parts, key) => {
    parts[key] = 0;
    return parts;
  }, {});
}

/**
 * Recept van het 100%-menu. De percentages worden na elkaar over de
 * resterende ruimte verdeeld, precies zoals in de oorspronkelijke generator.
 */
function recipe100(options: { pens: boolean; vis: boolean }): Fractions {
  const parts = emptyFractions();
  let rest = 1;

  if (options.vis) {
    parts.vis = rest * 0.15;
    rest -= parts.vis;
  }
  if (options.pens) {
    parts.pens = 0.15;
    rest -= parts.pens;
  }

  parts.karkas = rest / 2;
  rest -= parts.karkas;
  parts.orgaan = rest * 0.15;
  rest -= parts.orgaan;
  parts.spier = rest * 0.4;
  rest -= parts.spier;
  parts.bot = rest;

  return parts;
}

function recipePlus(options: { pens: boolean; vis: boolean }): Fractions {
  const parts = emptyFractions();
  let rest = 1;

  if (options.vis) {
    parts.vis = rest * 0.15;
    rest -= parts.vis;
  }
  if (options.pens) {
    parts.pens = 0.15;
    rest -= parts.pens;
  }
  parts.gemalen = rest;

  return parts;
}

export function compositionFor(input: AdviceInput): CompositionPart[] {
  const donts = input.donts.map((value) => value.toUpperCase());
  const avoidPens = donts.includes("PENS");
  const avoidVis = donts.includes("VIS");
  const options = {
    pens: input.ras === "HOND" && !avoidPens,
    vis: !avoidVis,
  };

  const parts =
    input.kind === "PLUS"
      ? recipePlus(options)
      : input.kind === "COMBI"
        ? average(recipe100(options), recipePlus(options))
        : recipe100(options);

  const packageGrams = input.packageKg * 1000;
  const composition = PART_ORDER.map((key) => {
    const percent = Math.round(parts[key] * 1000) / 10;
    return { key, label: PART_LABELS[key], percent };
  }).filter((part) => part.percent > 0);

  // Door afronding kan het totaal net geen 100% zijn; dat is visueel hinderlijk.
  if (composition.length > 0) {
    const total = composition.reduce((sum, part) => sum + part.percent, 0);
    const last = composition[composition.length - 1];
    last.percent = Math.round((last.percent + (100 - total)) * 10) / 10;
  }

  return composition.map((part) => ({
    ...part,
    grams: Math.round((part.percent / 100) * packageGrams),
  }));
}

function average(a: Fractions, b: Fractions): Fractions {
  const parts = emptyFractions();
  for (const key of PART_ORDER) parts[key] = (a[key] + b[key]) / 2;
  return parts;
}

export function buildAdvice(input: AdviceInput): AdviceResult {
  if (input.ras !== "KAT" && input.ras !== "HOND") {
    throw new Error("Kies een hond of een kat.");
  }
  if (!(input.weight >= 0.5 && input.weight <= 90)) {
    throw new Error("Vul een gewicht tussen 0,5 en 90 kg in.");
  }
  if (!["100", "PLUS", "COMBI"].includes(input.kind)) {
    throw new Error("Kies een pakketstijl.");
  }
  if (!(PACKAGE_SIZES as readonly number[]).includes(input.packageKg)) {
    throw new Error("Kies een pakketgrootte van 5, 10, 15 of 20 kg.");
  }

  const dailyGrams = dailyGramsFor(input.ras, input.weight);
  const mealsPerDay = mealsPerDayFor(input.pup);
  const days = daysForPackage(input.ras, input.weight, input.packageKg);
  const dailyRounded = Math.round(dailyGrams);
  const mealRounded = Math.round(dailyGrams / mealsPerDay);

  const notes: string[] = [];
  const warnings: string[] = [];

  if (input.donts.map((value) => value.toUpperCase()).includes("PENS")) {
    notes.push(
      input.ras === "HOND"
        ? "Pens is weggelaten. De ruimte gaat naar gemalen vlees of karkas en bot."
        : "Katten krijgen in dit menu standaard geen pens.",
    );
  }
  if (input.donts.map((value) => value.toUpperCase()).includes("VIS")) {
    notes.push("Vis is weggelaten. De rest van het menu vult de ruimte op.");
  }
  if (input.pup) {
    warnings.push(
      "Voor puppy's en kittens geldt een ander rantsoen dan voor volwassen dieren. Gebruik dit als startpunt en stem de hoeveelheid af met je dierenarts.",
    );
  }
  if (input.ras === "KAT" && input.weight > 8) {
    warnings.push(
      "Bij een gewicht boven 8 kg is het verstandig om de hoeveelheid en gezondheid met je dierenarts te bespreken.",
    );
  }

  return {
    dailyGrams: dailyRounded,
    mealGrams: mealRounded,
    mealsPerDay,
    days,
    composition: compositionFor(input),
    notes,
    warnings,
  };
}

export interface AdviceMineralPart {
  key: string;
  label: string;
  grams: number;
  /** g calcium per 100 g van dit deel. */
  calcium: number | null;
  /** Bijdrage van dit deel aan het calcium in het hele pakket. */
  calciumG: number;
}

export interface AdviceMinerals {
  report: MineralReport;
  parts: AdviceMineralPart[];
  band: MineralBand;
  rangeMin: number;
  rangeMax: number | null;
  /** Calcium in het dagrantsoen, op basis van de samenstelling per 100 g. */
  dailyCalciumG: number;
}

/**
 * Calcium en fosfor van een menu, berekend uit de samenstelling. De waarden per
 * deel komen uit de analyses van de losse producten (zie `minerals.ts`); de
 * uitkomst wordt getoetst aan de FEDIAF-band van dit dier.
 */
export function adviceMinerals(
  composition: CompositionPart[],
  ras: Dier,
  pup: boolean,
  dailyGrams: number,
): AdviceMinerals {
  const band = bandFor(ras, pup);
  const items = composition.map((part) => ({
    grams: part.grams,
    minerals: partMinerals(part.key),
  }));
  const report = summariseMinerals(items, band);
  const range = calciumRangePer100g(band);
  const parts: AdviceMineralPart[] = composition.map((part) => {
    const minerals = partMinerals(part.key);
    return {
      key: part.key,
      label: part.label,
      grams: part.grams,
      calcium: minerals.calcium,
      calciumG:
        minerals.calcium === null
          ? 0
          : Math.round(((part.grams * minerals.calcium) / 100) * 100) / 100,
    };
  });
  return {
    report,
    parts,
    band,
    rangeMin: range.min,
    rangeMax: range.max,
    dailyCalciumG: Math.round(((report.calciumPer100g / 100) * dailyGrams) * 100) / 100,
  };
}

export function styleLabel(kind: PackageKind): string {
  return ADVICE_STYLES[kind]?.label ?? kind;
}

export function portieLabel(portie: Portie): string {
  if (portie === "kleine porties") return "Kleine stukken (tot 250 g)";
  if (portie === "grote porties") return "Grote stukken (vanaf 500 g)";
  return "Maakt niet uit";
}

export function packageSummary(input: AdviceInput): string {
  return `${input.packageKg} kg · ${styleLabel(input.kind)}`;
}

export function formatAdviceGrams(value: number): string {
  return `${Math.round(value).toLocaleString("nl-NL")} g`;
}

export const adviceDaysLabel = (days: number): string =>
  days === 1 ? "1 dag" : `${days} dagen`;
