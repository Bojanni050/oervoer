import { bandFor, summariseMinerals, type MineralReport } from "./minerals";
import type { Dier } from "./types";

/**
 * De voercheck: een baasje voert in wat het dier eet, wij tellen de
 * voedingsstoffen op en zetten dat naast de norm voor dat dier.
 *
 * Bewust dezelfde rekenkern als het advies (`minerals.ts`), zodat er niet twee
 * waarheden ontstaan over calcium, fosfor en de Ca:P-verhouding.
 */

export interface VoercheckItem {
  name: string;
  grams: number;
  /** g calcium per 100 g product */
  calcium: number | null;
  /** g fosfor per 100 g product */
  fosfor: number | null;
  /** kcal per 100 g product */
  energie: number | null;
  /** g eiwit per 100 g product */
  eiwit?: number | null;
  /** g vet per 100 g product */
  vet?: number | null;
  /** Herkomst van de cijfers: catalogus, usda, of zelf ingevoerd. */
  bron?: string;
}

export interface VoercheckTotals {
  grams: number;
  calcium: number;
  fosfor: number;
  energie: number;
  eiwit: number;
  vet: number;
  /** g calcium per 100 g voer */
  calciumPer100g: number;
  /** g calcium per 1000 kcal */
  calciumPer1000kcal: number | null;
  caP: number | null;
  /** Aandeel van de energie uit eiwit en vet, in procenten. */
  eiwitPct: number | null;
  vetPct: number | null;
}

export interface VoercheckResult {
  totals: VoercheckTotals;
  report: MineralReport;
  /** Hoeveel regels geen eigen calciumwaarde hadden. */
  zonderCalcium: number;
}

function sumBy(items: VoercheckItem[], field: "calcium" | "fosfor" | "energie" | "eiwit" | "vet"): number {
  return items.reduce((sum, item) => {
    const value = item[field];
    if (value === null || value === undefined) return sum;
    return sum + (item.grams * value) / 100;
  }, 0);
}

export function voercheckTotals(
  items: VoercheckItem[],
  ras: Dier,
  pup: boolean,
): VoercheckResult {
  const grams = items.reduce((sum, item) => sum + Math.max(0, item.grams), 0);
  const calcium = sumBy(items, "calcium");
  const fosfor = sumBy(items, "fosfor");
  const energie = sumBy(items, "energie");
  const eiwit = sumBy(items, "eiwit");
  const vet = sumBy(items, "vet");

  const report = summariseMinerals(
    items.map((item) => ({
      grams: item.grams,
      minerals: { calcium: item.calcium, fosfor: item.fosfor, energie: item.energie },
    })),
    bandFor(ras, pup),
  );

  const totals: VoercheckTotals = {
    grams,
    calcium,
    fosfor,
    energie,
    eiwit,
    vet,
    calciumPer100g: grams > 0 ? (calcium / grams) * 100 : 0,
    calciumPer1000kcal: energie > 0 ? (calcium / energie) * 1000 : null,
    caP: fosfor > 0 ? calcium / fosfor : null,
    eiwitPct: energie > 0 ? ((eiwit * 4) / energie) * 100 : null,
    vetPct: energie > 0 ? ((vet * 9) / energie) * 100 : null,
  };

  return {
    totals,
    report,
    zonderCalcium: items.filter((item) => item.calcium === null || item.calcium === undefined).length,
  };
}

/** Korte, feitelijke samenvatting onder de cijfers. */
export function voercheckSamenvatting(result: VoercheckResult): string {
  const { totals, report } = result;
  if (totals.grams <= 0) return "Vul eerst in wat je dier eet.";
  if (result.zonderCalcium > 0) {
    return `${result.zonderCalcium} regel(s) zonder eigen analyse: die tellen niet mee in het calciumtotaal.`;
  }
  return report.message;
}
