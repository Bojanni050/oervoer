import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

/**
 * De catalogus: producten waarvan we de voedingswaarde kennen, uit externe
 * bronnen (darf.nl, later NEVO/USDA) of door Bo zelf ingevoerd.
 *
 * De opbouw staat in `db/catalog.sql` zodat de scanner (los Node-proces, geen
 * TypeScript) en de app exact dezelfde tabellen gebruiken. Dit bestand leest
 * alleen; schrijven doet scripts/catalog-scan.mjs.
 */

export const CATALOG_SQL_FILE = path.join(process.cwd(), "db", "catalog.sql");

type SqlRow = Record<string, string | number | bigint | null>;

export interface CatalogHit {
  id: number;
  sourceKey: string;
  externalId: string;
  url: string;
  brand: string;
  name: string;
  animal: string;
  flavor: string;
  part: string;
  wholeAnimal: boolean;
  weightG: number | null;
  priceCents: number | null;
  available: boolean;
  calcium: number | null;
  fosfor: number | null;
  energie: number | null;
  calciumSource: string;
  energieSource: string;
  matchedAlias: string | null;
  score: number;
}

export interface CatalogStats {
  total: number;
  active: number;
  withCalcium: number;
  withFosfor: number;
  withEnergie: number;
  perSource: Array<{ sourceKey: string; name: string; count: number; withCalcium: number }>;
  lastRun: { startedAt: string; status: string; found: number; changed: number } | null;
  pendingChanges: number;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Zet de catalogustabellen neer als ze nog niet bestaan (idempotent). */
export function ensureCatalogSchema(db: DatabaseSync): void {
  if (!fs.existsSync(CATALOG_SQL_FILE)) return;
  db.exec(fs.readFileSync(CATALOG_SQL_FILE, "utf8"));
}

function mapHit(row: SqlRow): CatalogHit {
  return {
    id: Number(row.id),
    sourceKey: str(row.source_key),
    externalId: str(row.external_id),
    url: str(row.url),
    brand: str(row.brand),
    name: str(row.name),
    animal: str(row.animal),
    flavor: str(row.flavor),
    part: str(row.part),
    wholeAnimal: Number(row.whole_animal) === 1,
    weightG: num(row.weight_g),
    priceCents: num(row.price_cents),
    available: Number(row.available) === 1,
    calcium: num(row.calcium),
    fosfor: num(row.fosfor),
    energie: num(row.energie),
    calciumSource: str(row.calcium_source),
    energieSource: str(row.energie_source),
    matchedAlias: row.matched_alias ? str(row.matched_alias) : null,
    score: num(row.score) ?? 3,
  };
}

/**
 * Zoekt op productnaam, merk en aliassen. Rang: hele naam, naam begint met de
 * zoekterm, alias, en anders "komt voor in de naam" — zodat "kipnek" bovenaan
 * Kipnekken zet en niet Kippenlever.
 */
export function searchCatalog(db: DatabaseSync, query: string, limit = 10): CatalogHit[] {
  const term = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (term.length < 2) return [];
  // Elk woord apart matchen, in willekeurige volgorde: "kip nek" vindt
  // "Kipnekken" en "karkas kip" vindt "Kipkarkas Polderhoen".
  const words = term.split(" ").filter(Boolean);
  const nameCondition = words.map(() => "lower(p.name) LIKE ?").join(" AND ");
  const aliasCondition = words.map(() => "lower(a4.alias) LIKE ?").join(" AND ");
  const like = `%${words.join("%")}%`;
  const prefix = `${words[0]}%`;

  const rows = db
    .prepare(
      `SELECT p.*,
              s.source_key AS source_key,
              (SELECT a.alias FROM catalog_aliases a
                 WHERE a.product_id = p.id AND lower(a.alias) LIKE ?
                 ORDER BY length(a.alias) LIMIT 1) AS matched_alias,
              CASE
                WHEN lower(p.name) = ? THEN 0
                WHEN lower(p.name) LIKE ? THEN 1
                WHEN EXISTS (SELECT 1 FROM catalog_aliases a2
                              WHERE a2.product_id = p.id AND lower(a2.alias) = ?) THEN 2
                WHEN EXISTS (SELECT 1 FROM catalog_aliases a3
                              WHERE a3.product_id = p.id AND lower(a3.alias) LIKE ?) THEN 3
                ELSE 4
              END AS score
         FROM catalog_products p
         JOIN catalog_sources s ON s.id = p.source_id
        WHERE p.active = 1
          AND (( ${nameCondition} )
               OR EXISTS (SELECT 1 FROM catalog_aliases a4
                           WHERE a4.product_id = p.id AND ( ${aliasCondition} )))
        ORDER BY score, length(p.name), p.name
        LIMIT ?`,
    )
    .all(
      like,
      term,
      prefix,
      term,
      like,
      ...words.map((word) => `%${word}%`),
      ...words.map((word) => `%${word}%`),
      limit,
    ) as SqlRow[];

  return rows.map(mapHit);
}

export function catalogStats(db: DatabaseSync): CatalogStats {
  const total = Number((db.prepare("SELECT COUNT(*) AS n FROM catalog_products").get() as SqlRow).n);
  const active = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE active = 1").get() as SqlRow).n,
  );
  const withCalcium = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE calcium IS NOT NULL").get() as SqlRow).n,
  );
  const withFosfor = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE fosfor IS NOT NULL").get() as SqlRow).n,
  );
  const withEnergie = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE energie IS NOT NULL").get() as SqlRow).n,
  );

  const perSource = (
    db
      .prepare(
        `SELECT s.source_key AS source_key, s.name AS name,
                COUNT(p.id) AS count,
                SUM(CASE WHEN p.calcium IS NOT NULL THEN 1 ELSE 0 END) AS with_calcium
           FROM catalog_sources s
           LEFT JOIN catalog_products p ON p.source_id = s.id AND p.active = 1
          GROUP BY s.id
          ORDER BY count DESC`,
      )
      .all() as SqlRow[]
  ).map((row) => ({
    sourceKey: str(row.source_key),
    name: str(row.name),
    count: Number(row.count),
    withCalcium: Number(row.with_calcium ?? 0),
  }));

  const run = db
    .prepare(
      `SELECT started_at, status, found, changed
         FROM catalog_runs ORDER BY id DESC LIMIT 1`,
    )
    .get() as SqlRow | undefined;

  const pending = Number(
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM catalog_changes WHERE status = 'wacht'")
        .get() as SqlRow
    ).n,
  );

  return {
    total,
    active,
    withCalcium,
    withFosfor,
    withEnergie,
    perSource,
    lastRun: run
      ? {
          startedAt: str(run.started_at),
          status: str(run.status),
          found: Number(run.found ?? 0),
          changed: Number(run.changed ?? 0),
        }
      : null,
    pendingChanges: pending,
  };
}

export interface PendingChange {
  id: number;
  productName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

/** Wijzigingen die op goedkeuring wachten (afwijking > 10%). */
export function listPendingCatalogChanges(db: DatabaseSync, limit = 50): PendingChange[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.field, c.old_value, c.new_value, c.changed_at, p.name
         FROM catalog_changes c
         JOIN catalog_products p ON p.id = c.product_id
        WHERE c.status = 'wacht'
        ORDER BY c.id DESC
        LIMIT ?`,
    )
    .all(limit) as SqlRow[];

  return rows.map((row) => ({
    id: Number(row.id),
    productName: str(row.name),
    field: str(row.field),
    oldValue: row.old_value === null ? null : str(row.old_value),
    newValue: row.new_value === null ? null : str(row.new_value),
    changedAt: str(row.changed_at),
  }));
}

/**
 * Keurt een wachtende wijziging goed of af. Goedkeuren schrijft de nieuwe
 * waarde naar het product; afkeuren laat het product ongemoeid.
 */
export function resolveCatalogChange(
  db: DatabaseSync,
  changeId: number,
  decision: "overgenomen" | "afgekeurd",
): boolean {
  const change = db
    .prepare(
      `SELECT c.id, c.product_id, c.field, c.new_value, c.status
         FROM catalog_changes c WHERE c.id = ?`,
    )
    .get(changeId) as SqlRow | undefined;
  if (!change || str(change.status) !== "wacht") return false;

  const field = str(change.field);
  const allowed = ["calcium", "fosfor", "energie", "weight_g", "price_cents"];
  if (decision === "overgenomen" && allowed.includes(field)) {
    const value = change.new_value === null ? null : Number(change.new_value);
    db.prepare(`UPDATE catalog_products SET ${field} = ?, updated_at = ? WHERE id = ?`).run(
      value,
      new Date().toISOString(),
      Number(change.product_id),
    );
  }
  db.prepare("UPDATE catalog_changes SET status = ? WHERE id = ?").run(decision, changeId);
  return true;
}
