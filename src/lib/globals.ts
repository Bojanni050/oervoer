/**
 * Constanten uit de originele wizard (oervoer/globals.py).
 * De getallen zijn ongewijzigd overgenomen; ze bepalen de samenstelling
 * van een pakket en de maaltijdgrootte per dier.
 */

export const CAT_FACTOR = 0.035; // 35 gram voeding per kg lichaamsgewicht per dag
export const DOG_FACTOR = 0.025; // 25 gram voeding per kg lichaamsgewicht per dag
export const MEAL_FACTOR = 4; // deelbare producten: max 4x maaltijd
export const MEAL_FACTOR_SMALL = 0.19; // deelbare producten: min 0.19x maaltijd
export const MEAL_FACTOR_FIXED = 1.5; // ondeelbare producten: max 1.5x maaltijd
export const TRIES = 20; // aantal gegenereerde menu's per vleessoort
export const LIKE_FACTOR = 4; // smaakvoorkeur weegt 4x zwaarder
export const SMALL_MEAL = 0.251; // kg, bovengrens kleine portie
export const BIG_MEAL = 0.499; // kg, ondergrens grote portie
export const MAX_TRIES = 150; // vullingspogingen voordat we opgeven
export const LIVER_SHARE = 0.4; // max aandeel lever in de orgaangroep

export const VIS = "VIS";
export const VIS_GEMALEN = "GEMALEN VIS";
export const PENS = "PENS";
export const SPIER = "SPIERVLEES";
export const ZACHT_BOT = "ZACHT BOT";
export const MIDDEL_BOT = "MIDDEL BOT";
export const HARD_BOT = "HARD BOT";
export const GEMALEN = "COMPLEET GEMALEN";
export const KARKAS = "COMPLEET KARKAS";
export const BOT = "BOT";
export const LEVER = "LEVER";
export const HEAD = "KOP";
export const KARKAS_ZACHT = "COMPLEET KARKAS.ZACHT BOT";
export const KARKAS_MIDDEL = "COMPLEET KARKAS.MIDDEL BOT";
export const KARKAS_HARD = "COMPLEET KARKAS.HARD BOT";
export const ORGAAN = "ORGAAN";

/** Volgorde waarin de picklijst wordt gegroepeerd. */
export const VLEES_TYPES = [
  VIS,
  VIS_GEMALEN,
  PENS,
  "SPIERVLEES",
  ZACHT_BOT,
  MIDDEL_BOT,
  HARD_BOT,
  KARKAS,
  KARKAS_ZACHT,
  KARKAS_MIDDEL,
  KARKAS_HARD,
  ORGAAN,
  GEMALEN,
] as const;

/** Types die in porties te verdelen zijn (factoren 4 / 0.19). */
export const VLEES_DEELBAAR = [
  BOT,
  ZACHT_BOT,
  MIDDEL_BOT,
  HARD_BOT,
  GEMALEN,
  VIS_GEMALEN,
  ORGAAN,
  PENS,
  "SPIERVLEES",
];

/** Types waarbij de portiegrootte-voorkeur van de klant geldt. */
export const PORTIE_TYPEN = [GEMALEN, PENS, "SPIERVLEES"];

export const KARKASSEN = [KARKAS_HARD, KARKAS_MIDDEL, KARKAS_ZACHT, KARKAS];

export const KARKAS_DICT: Record<"KAT" | "HOND", string[]> = {
  KAT: [KARKAS, KARKAS_ZACHT],
  HOND: KARKASSEN,
};

export const PACKAGE_KINDS = ["100", "PLUS", "COMBI"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

export const PACKAGE_LABELS: Record<PackageKind, string> = {
  "100": "100% OerVoer",
  PLUS: "Gemalen Plus",
  COMBI: "Combinatie",
};

export const PORTIES = ["beide", "kleine porties", "grote porties"] as const;
export type Portie = (typeof PORTIES)[number];

export function factorFor(ras: "KAT" | "HOND"): number {
  return ras === "KAT" ? CAT_FACTOR : DOG_FACTOR;
}
