/**
 * Port van de originele picklist-generator (oervoer/oervoer.py, Python 2).
 *
 * De aanpak is bewust trouw gebleven: per vleessoort worden 20 menu's
 * gegenereerd met gewogen willekeurige producten, waarna het menu met de
 * meest gevarieerde smaken en de kleinste gewichtsafwijking wint.
 */
import {
  BIG_MEAL,
  CAT_FACTOR,
  DOG_FACTOR,
  GEMALEN,
  KARKAS,
  KARKAS_DICT,
  LIVER_SHARE,
  MAX_TRIES,
  MEAL_FACTOR,
  MEAL_FACTOR_FIXED,
  MEAL_FACTOR_SMALL,
  ORGAAN,
  PENS,
  PORTIE_TYPEN,
  SMALL_MEAL,
  SPIER,
  TRIES,
  VLEES_DEELBAAR,
  VLEES_TYPES,
  VIS,
  VIS_GEMALEN,
  LIKE_FACTOR,
} from "./globals";
import {
  productMinerals,
  summariseMinerals,
  type MineralBand,
  type MineralReport,
} from "./minerals";
import type {
  Dier,
  OrderRecord,
  PicklistItem,
  PicklistWarning,
  Product,
  ProductRow,
} from "./types";

export class NoProductsError extends Error {
  products: Product[];
  weight: number;
  constructor(message: string, products: Product[] = [], weight = 0) {
    super(message);
    this.name = "NoProductsError";
    this.products = products;
    this.weight = weight;
  }
}

/* ------------------------------------------------------------------ */
/* Willekeurige getallen met een seed, zodat een picklijst reproduceerbaar is. */
/* ------------------------------------------------------------------ */

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class WeightedRandom {
  private cumulative: number[] = [];

  constructor(private weights: number[]) {
    let sum = 0;
    for (const weight of weights) {
      sum += weight;
      this.cumulative.push(sum);
    }
  }

  rand(rng: Rng): number {
    if (this.cumulative.length === 0 || this.cumulative[this.cumulative.length - 1] <= 0) {
      throw new Error("Lege of gewichtsloze productlijst");
    }
    const total = this.cumulative[this.cumulative.length - 1];
    const value = Math.floor(rng() * (total + 1));
    let index = 0;
    while (index < this.cumulative.length - 1 && value > this.cumulative[index]) index++;
    return index;
  }
}

/* ------------------------------------------------------------------ */
/* Invoer omzetten                                                    */
/* ------------------------------------------------------------------ */

export function productFromRow(row: ProductRow): Product {
  const weight = Number.parseFloat(row.weight) || 0;
  const verpaktPer = Number.parseInt(row.verpakt_per, 10) || 1;
  return {
    sku: row.sku,
    name: row.name,
    smaak: (row.smaak || "").trim().toUpperCase(),
    typeVlees: (row.type_vlees || "").trim().toUpperCase(),
    shelf: (row.shelf || "").trim(),
    weight,
    verpaktPer,
    qty: Math.max(0, Math.trunc(Number.parseFloat(row.qty) || 0)),
    inStock: row.is_in_stock !== "0",
    geschiktMenu: (row.geschiktmenu || "").trim().toUpperCase() === "JA",
    geschiktVoor: (row["geschikt voor"] || "").toUpperCase(),
    normWeight: weight / verpaktPer,
    calcium: parseRowNumber(row.calcium),
    fosfor: parseRowNumber(row.fosfor),
  };
}

/** Waarde uit een optionele CSV-kolom; null als die leeg, "-" of onleesbaar is. */
function parseRowNumber(value: string | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || text === "-") return null;
  const parsed = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isMenuProduct(product: Product): boolean {
  return (
    product.geschiktMenu && (VLEES_TYPES as readonly string[]).includes(product.typeVlees)
  );
}

export function usableProducts(products: Product[]): Product[] {
  return products.filter((product) => isMenuProduct(product) && product.qty > 0);
}

export interface OrderInput {
  ras: Dier;
  weight: number;
  packageKg: number;
  kind: string;
  donts: string[];
  prefers: string[];
  portie: OrderRecord["portie"];
  factor: number;
}

export function mealSizeFor(order: Pick<OrderInput, "ras" | "weight" | "factor">): number {
  const factor = order.ras === "KAT" ? CAT_FACTOR : DOG_FACTOR;
  return (order.weight * order.factor * factor) / 2;
}

export function daysFor(order: Pick<OrderInput, "ras" | "weight" | "packageKg">): number {
  const factor = order.ras === "KAT" ? CAT_FACTOR : DOG_FACTOR;
  if (order.weight <= 0) return 0;
  return Math.round(order.packageKg / (order.weight * factor));
}

/* ------------------------------------------------------------------ */
/* Generator                                                          */
/* ------------------------------------------------------------------ */

export interface GenerationResult {
  items: PicklistItem[];
  warnings: PicklistWarning[];
  totalKg: number;
  mealSize: number;
  days: number;
}

export function generatePicklist(
  order: OrderInput,
  parsedProducts: Product[],
  seed: number = Math.floor(Math.random() * 2 ** 31),
): GenerationResult {
  const rng = makeRng(seed);
  const products = usableProducts(parsedProducts).map((product) => ({ ...product }));
  const lists = new Map<string, Product[]>();
  for (const type of VLEES_TYPES) lists.set(type, []);

  for (const product of products) {
    lists.get(product.typeVlees)?.push(product);
  }

  const warnings: PicklistWarning[] = [];
  const donts = order.donts.map((value) => value.toUpperCase());
  const prefers = order.prefers.map((value) => value.toUpperCase());
  const mealSize = mealSizeFor(order);

  const productListFor = (vlees: string): Product[] => {
    if (vlees === "BOT") {
      const types =
        order.ras === "HOND" ? ["ZACHT BOT", "MIDDEL BOT", "HARD BOT"] : ["ZACHT BOT"];
      return types.flatMap((type) => lists.get(type) ?? []);
    }
    if (vlees === VIS) {
      return [...(lists.get(VIS) ?? []), ...(lists.get(VIS_GEMALEN) ?? [])];
    }
    if (vlees === KARKAS) {
      return (KARKAS_DICT[order.ras] ?? []).flatMap((type) => lists.get(type) ?? []);
    }
    return lists.get(vlees) ?? [];
  };

  const allowedByDiet = (product: Product): boolean => {
    const tasteParts = product.smaak.split(".");
    if (donts.includes(product.smaak)) return false;
    if (donts.includes(tasteParts[0])) return false;
    if (donts.includes(product.typeVlees)) return false;
    if (tasteParts.some((part) => donts.includes(part))) return false;
    return true;
  };

  const makeList = (vlees: string): { weighted: WeightedRandom; candidates: Product[] } => {
    const deelbaar = VLEES_DEELBAAR.includes(vlees);
    const maxFactor = deelbaar ? MEAL_FACTOR : MEAL_FACTOR_FIXED;
    const minFactor = deelbaar ? MEAL_FACTOR_SMALL : 0;

    let source = productListFor(vlees);
    source = source.sort((a, b) => a.normWeight - b.normWeight);

    const fitsPortie = (product: Product): boolean => {
      if (PORTIE_TYPEN.includes(vlees) && order.portie === "grote porties") {
        return product.normWeight >= BIG_MEAL;
      }
      if (PORTIE_TYPEN.includes(vlees) && order.portie === "kleine porties") {
        return product.normWeight <= SMALL_MEAL;
      }
      return (
        product.normWeight <= mealSize * maxFactor && product.normWeight >= mealSize * minFactor
      );
    };

    const suitsAnimal =
      order.ras === "KAT" ? productSuitableForCat : productSuitableForDog;

    let candidates = source.filter(
      (product) => fitsPortie(product) && allowedByDiet(product) && suitsAnimal(product),
    );

    if (candidates.length === 0 && source.length > 0) {
      // Terugvaloptie: kies de kleinste of grootste producten, net als het origineel.
      const fallback =
        mealSize * maxFactor < source[0].normWeight
          ? source.filter((product) => product.normWeight <= SMALL_MEAL)
          : source.filter((product) => product.normWeight >= BIG_MEAL);
      candidates = (fallback.length > 0 ? fallback : source).filter(allowedByDiet);
    }

    const weights = candidates.map((product) => {
      const base = product.qty;
      return prefers.includes(product.smaak) ? base * LIKE_FACTOR : base;
    });

    return { weighted: new WeightedRandom(weights), candidates };
  };

  const isFishHead = (product: Product): boolean => {
    const parts = product.smaak.split(".");
    return parts.length > 1 && parts[1] === "KOP";
  };

  const fill = (
    vlees: string,
    weighted: WeightedRandom,
    candidates: Product[],
    targetWeight: number,
  ): { weight: number; selection: Product[] } => {
    const selection: Product[] = [];
    let totalWeight = 0;
    let fishHeadUsed = false;

    if (vlees === ORGAAN) {
      let tries = 0;
      while (totalWeight < targetWeight && tries < 20) {
        tries++;
        for (const product of candidates) {
          if (donts.includes(product.smaak)) continue;
          const liver = product.smaak.includes("LEVER");
          const wantLiver = totalWeight <= targetWeight * LIVER_SHARE;
          if (wantLiver === liver) {
            totalWeight += product.weight;
            selection.push(product);
          }
          if (totalWeight >= targetWeight) break;
        }
      }
      return { weight: totalWeight, selection };
    }

    let attempts = 0;
    while (totalWeight < targetWeight && attempts <= MAX_TRIES) {
      attempts++;
      const product = candidates[weighted.rand(rng)];
      if (!product) break;
      const head = isFishHead(product);
      if (head && fishHeadUsed) continue;
      totalWeight += product.weight;
      selection.push(product);
      if (head) fishHeadUsed = true;
    }

    if (attempts > MAX_TRIES) {
      throw new NoProductsError(
        `Kan lijst ${vlees} niet vullen; pakket mogelijk te groot of viskop-regel actief.`,
        selection,
        totalWeight,
      );
    }
    return { weight: totalWeight, selection };
  };

  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const stdDev = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
    );
  };

  const chooseBest = (selections: Product[][], targetWeight: number): Product[] => {
    const scored = selections.map((selection) => {
      const tastes = new Map<string, number>();
      for (const product of selection) {
        tastes.set(product.smaak, (tastes.get(product.smaak) ?? 0) + product.weight);
      }
      return { selection, tastes: [...tastes.values()], distinct: tastes.size };
    });

    const middle = median(scored.map((entry) => entry.distinct));
    const final = scored.filter((entry) => {
      const deviation = Math.abs(targetWeight - entry.tastes.reduce((a, b) => a + b, 0));
      return entry.distinct >= middle && deviation <= targetWeight * 0.25;
    });

    const pool = final.length > 0 ? final : scored;
    pool.sort((a, b) => stdDev(a.tastes) - stdDev(b.tastes));
    return pool[0]?.selection ?? [];
  };

  const selectType = (
    vlees: string,
    targetWeight: number,
  ): { weight: number; selection: Product[] } => {
    if (targetWeight <= 0) return { weight: 0, selection: [] };
    const { weighted, candidates } = makeList(vlees);
    if (candidates.length === 0) {
      throw new NoProductsError(`Geen geschikte producten voor ${vlees}.`);
    }

    const selections: Product[][] = [];
    let lastError: unknown = null;
    for (let attempt = 0; attempt < TRIES; attempt++) {
      try {
        selections.push(fill(vlees, weighted, candidates, targetWeight).selection);
      } catch (error) {
        lastError = error;
      }
    }
    if (selections.length === 0) {
      if (lastError instanceof NoProductsError) throw lastError;
      throw new NoProductsError(`Niet genoeg producten voor ${vlees}.`);
    }

    const selection = chooseBest(selections, targetWeight);
    const weight = selection.reduce((sum, product) => sum + product.weight, 0);
    return { weight, selection };
  };

  const collect = (vlees: string, targetWeight: number, into: Product[]) => {
    try {
      const result = selectType(vlees, targetWeight);
      into.push(...result.selection);
      return result.weight;
    } catch (error) {
      if (error instanceof NoProductsError) {
        warnings.push({ type: vlees, message: error.message });
        into.push(...error.products);
        return error.weight;
      }
      throw error;
    }
  };

  const makePlus = (): Product[] => {
    const result: Product[] = [];
    let rest = order.packageKg;
    rest -= collect(VIS, rest * 0.15, result);

    const avoidPens = donts.includes(PENS);
    if (order.ras !== "KAT" && !avoidPens) {
      rest -= collect(PENS, order.packageKg * 0.15, result);
    }
    collect(GEMALEN, rest, result);
    return result;
  };

  const make100 = (): Product[] => {
    const result: Product[] = [];
    let rest = order.packageKg;

    rest -= collect(VIS, rest * 0.15, result);

    const avoidPens = donts.includes(PENS);
    if (order.ras !== "KAT" && !avoidPens) {
      rest -= collect(PENS, order.packageKg * 0.15, result);
    }
    rest -= collect(KARKAS, rest / 2, result);
    const orgaanWeight = collect(ORGAAN, rest * 0.15, result);
    const spierWeight = collect(SPIER, rest * 0.4, result);
    rest -= orgaanWeight + spierWeight;
    collect("BOT", rest, result );

    return result;
  };

  let chosen: Product[];
  const kind = order.kind.toUpperCase();
  if (kind === "PLUS") {
    chosen = makePlus();
  } else if (kind === "COMBI") {
    const original = order.packageKg;
    order = { ...order, packageKg: original / 2 };
    chosen = [...make100(), ...makePlus()];
    order = { ...order, packageKg: original };
  } else {
    chosen = make100();
  }

  // correct_result: haal een dubbele sku weg als het pakket te zwaar is.
  const packageKg = order.packageKg;
  const weights = chosen.map((product) => product.weight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const delta = Math.abs(packageKg - total);
  if (delta >= 0.05 && total > packageKg && weights.length > 0) {
    const closest = Math.min(...weights.map((weight) => Math.abs(weight - delta)));
    const index = weights.findIndex((weight) => Math.abs(weight - delta) === closest);
    const sku = chosen[index]?.sku;
    if (sku && chosen.filter((product) => product.sku === sku).length > 1) {
      chosen.splice(index, 1);
    }
  }

  const grouped = new Map<string, PicklistItem>();
  for (const product of chosen) {
    const existing = grouped.get(product.sku);
    if (existing) {
      existing.count += 1;
      existing.totalKg = Number((existing.totalKg + product.weight).toFixed(3));
    } else {
      const minerals = productMinerals(product);
      grouped.set(product.sku, {
        sku: product.sku,
        name: product.name,
        smaak: product.smaak,
        typeVlees: product.typeVlees,
        shelf: product.shelf,
        weight: product.weight,
        count: 1,
        totalKg: Number(product.weight.toFixed(3)),
        calcium: minerals.calcium,
        fosfor: minerals.fosfor,
      });
    }
  }

  const items = [...grouped.values()].sort((a, b) => {
    const orderA = (VLEES_TYPES as readonly string[]).indexOf(a.typeVlees);
    const orderB = (VLEES_TYPES as readonly string[]).indexOf(b.typeVlees);
    return orderA - orderB || a.name.localeCompare(b.name, "nl");
  });

  return {
    items,
    warnings,
    totalKg: Number(items.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2)),
    mealSize: Number(mealSize.toFixed(4)),
    days: daysFor(order),
  };
}

function productSuitableForCat(product: Product): boolean {
  return product.geschiktVoor.includes("KAT");
}

function productSuitableForDog(product: Product): boolean {
  return product.geschiktVoor.includes("HOND");
}

/**
 * Calcium en fosfor van een complete picklijst, getoetst aan de band van het
 * dier. Werkt ook op picklijsten die vóór de mineralenberekening zijn gemaakt:
 * die regels missen `calcium` en vallen dan terug op hun vleestype.
 */
export function picklistMineralReport(items: PicklistItem[], band: MineralBand): MineralReport {
  return summariseMinerals(
    items.map((item) => ({
      grams: item.totalKg * 1000,
      minerals: productMinerals({
        typeVlees: item.typeVlees,
        calcium: item.calcium ?? null,
        fosfor: item.fosfor ?? null,
      }),
    })),
    band,
  );
}
