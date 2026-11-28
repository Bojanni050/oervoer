#!/usr/bin/env node
/**
 * Houdt de productcatalogus bij.
 *
 * De app rekent met voedingswaarden; die komen uit een catalogus van producten
 * van derden (nu darf.nl, later ook NEVO/USDA en eigen producten). Dit script
 * leest die bronnen, schrijft ze in de tabellen uit db/catalog.sql en legt elke
 * wijziging vast.
 *
 * Uitgangspunten:
 *   - beleefd: één verzoek per `--delay` ms, herkenbare user-agent, robots.txt
 *     wordt gerespecteerd, en bij twijfel stoppen we liever dan doorduwen;
 *   - niet-destructief: een product dat uit de sitemap verdwijnt gaat pas na
 *     drie gemiste runs op inactief, en een getal wordt nooit met leeg
 *     overschreven;
 *   - beheerst: een wijziging in calcium/fosfor/energie kleiner dan 10% wordt
 *     overgenomen en gelogd; groter dan dat blijft als 'wacht' staan tot Bo
 *     goedkeurt (--approve / --reject).
 *
 * Gebruik:
 *   node scripts/catalog-scan.mjs                     # darf.nl, hele sitemap
 *   node scripts/catalog-scan.mjs --limit 20          # eerste 20 producten
 *   node scripts/catalog-scan.mjs --import-snapshot   # bestaande snapshot inlezen
 *   node scripts/catalog-scan.mjs --dry-run           # niets schrijven
 *   node scripts/catalog-scan.mjs --list-pending      # wachtende wijzigingen
 *   node scripts/catalog-scan.mjs --approve 12        # wijziging overnemen
 *   node scripts/catalog-scan.mjs --stats             # stand van de catalogus
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  DARF_BASE,
  HEADERS,
  parseDetail,
  productFromDetail,
} from "./lib/darf-parse.mjs";

const DB_FILE = path.join(process.cwd(), ".data", "oervoer.db");
const SQL_FILE = path.join(process.cwd(), "db", "catalog.sql");
const SNAPSHOT_FILE = path.join(process.cwd(), "data", "darf-products.json");
const LOG_FILE = path.join(process.cwd(), ".data", "catalog-scan.log");
const LOCK_FILE = path.join(process.cwd(), ".data", "catalog-scan.lock");

/** Grotere afwijking dan dit wacht op goedkeuring in plaats van automatisch. */
const CHANGE_THRESHOLD = 0.1;
/** Na zoveel runs zonder vermelding in de sitemap gaat een product op inactief. */
const MISS_LIMIT = 3;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback = null) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return fallback;
};

const SOURCE = option("source", "darf");
const LIMIT = Number.parseInt(option("limit", "0"), 10) || 0;
const DELAY = Number.parseInt(option("delay", "1500"), 10);
const DRY_RUN = flag("dry-run");
const QUIET = flag("quiet");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => {
  if (!QUIET) console.log(...parts);
};
const now = () => new Date().toISOString();

/** Voorkomt dat twee scans tegelijk schrijven (timer + handmatige run). */
function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  if (fs.existsSync(LOCK_FILE)) {
    const pid = Number.parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
    let alive = false;
    try {
      if (pid > 0) {
        process.kill(pid, 0);
        alive = true;
      }
    } catch {
      alive = false;
    }
    if (alive) {
      console.error(`Er loopt al een scan (pid ${pid}). Verwijder ${LOCK_FILE} als dat niet klopt.`);
      process.exit(1);
    }
    fs.rmSync(LOCK_FILE, { force: true });
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  process.on("exit", releaseLock);
  process.on("SIGINT", () => process.exit(130));
  process.on("SIGTERM", () => process.exit(143));
}

function releaseLock() {
  try {
    fs.rmSync(LOCK_FILE, { force: true });
  } catch {
    // niets
  }
}

function openDb() {
  if (!fs.existsSync(SQL_FILE)) {
    console.error(`Ontbreekt: ${SQL_FILE}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(SQL_FILE, "utf8"));
  return db;
}

function sourceRow(db, key) {
  const row = db.prepare("SELECT * FROM catalog_sources WHERE source_key = ?").get(key);
  if (!row) {
    console.error(`Onbekende bron: ${key}`);
    process.exit(1);
  }
  return row;
}

function hashOf(payload) {
  return crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

/** Analyse-sleutel die bij een catalogusveld hoort. */
const ANALYSIS_KEY = {
  calcium: "calcium",
  fosfor: "fosfor",
  energie: "energieKcalPer100g",
};
const NUMERIC_FIELDS = new Set(Object.keys(ANALYSIS_KEY));

/** Payload waarop we "is dit product veranderd" bepalen. */
function contentPayload(product) {
  return {
    name: product.name,
    brand: product.brand,
    animal: product.animal,
    flavor: product.flavor,
    part: product.part,
    wholeAnimal: product.wholeAnimal ? 1 : 0,
    weightG: product.weightG ?? null,
    priceCents: product.priceCents ?? null,
    available: product.available === false ? 0 : 1,
    ingredients: product.ingredients ?? "",
    description: product.description ?? "",
    composition: product.composition ?? [],
    analysis: product.analysis ?? {},
    energieBron: product.energieBron ?? "",
  };
}

function rowFromProduct(product) {
  const analysis = product.analysis ?? {};
  const calcium = typeof analysis.calcium === "number" ? analysis.calcium : null;
  const fosfor = typeof analysis.fosfor === "number" ? analysis.fosfor : null;
  const energie = typeof analysis.energieKcalPer100g === "number" ? analysis.energieKcalPer100g : null;
  return {
    external_id: product.slug,
    url: product.url ?? "",
    brand: product.brand ?? "",
    name: product.name ?? "",
    animal: product.animal ?? "",
    flavor: product.flavor ?? "",
    part: product.part ?? "",
    whole_animal: product.wholeAnimal ? 1 : 0,
    weight_g: product.weightG ?? null,
    price_cents: product.priceCents ?? null,
    available: product.available === false ? 0 : 1,
    ingredients: product.ingredients ?? "",
    description: product.description ?? "",
    composition_json: JSON.stringify(product.composition ?? []),
    analysis_json: JSON.stringify(analysis),
    calcium,
    fosfor,
    energie,
    calcium_source: calcium === null ? "" : "opgave",
    energie_source: product.energieBron ?? "",
  };
}

const COLUMNS = [
  "external_id", "url", "brand", "name", "animal", "flavor", "part", "whole_animal",
  "weight_g", "price_cents", "available", "ingredients", "description",
  "composition_json", "analysis_json", "calcium", "fosfor", "energie",
  "calcium_source", "energie_source",
];

function sameValue(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a) === String(b);
}

/** Zoekvarianten die een baasje zou typen (slug met spaties, naam zonder merk). */
function aliasesFor(product) {
  const list = new Set();
  if (product.slug) list.add(String(product.slug).replace(/-/g, " "));
  // Dataset-bronnen leveren eigen zoekvarianten mee (bijv. "kipfilet, kip borst").
  for (const alias of String(product.aliases ?? "").split(",")) {
    const trimmed = alias.trim();
    if (trimmed.length >= 3) list.add(trimmed);
  }
  const brand = String(product.brand ?? "").trim();
  const name = String(product.name ?? "").trim();
  if (brand && name.toUpperCase().startsWith(brand.toUpperCase())) {
    const rest = name.slice(brand.length).trim();
    if (rest.length > 2) list.add(rest);
  }
  return [...list].filter((alias) => alias.length >= 3);
}

function addAliases(db, productId, product) {
  const insert = db.prepare("INSERT OR IGNORE INTO catalog_aliases (product_id, alias) VALUES (?, ?)");
  for (const alias of aliasesFor(product)) insert.run(productId, alias);
}

/**
 * Schrijft één product weg en legt de verschillen vast. Geeft terug wat er
 * gebeurde: nieuw, gewijzigd, wacht (grote afwijking) of gelijk.
 */
function upsertProduct(db, { sourceId, runId, product }) {
  const row = rowFromProduct(product);
  const hash = hashOf(contentPayload(product));
  const existing = db
    .prepare("SELECT * FROM catalog_products WHERE source_id = ? AND external_id = ?")
    .get(sourceId, row.external_id);
  const stamp = now();

  if (!existing) {
    if (DRY_RUN) return { status: "nieuw", pending: 0 };
    // Dezelfde inhoud onder een andere slug = hetzelfde product. darf.nl heeft
    // soms twee URL's voor één product; dan wordt de tweede een alias.
    const twin = db
      .prepare("SELECT id FROM catalog_products WHERE source_id = ? AND content_hash = ? LIMIT 1")
      .get(sourceId, hash);
    if (twin) {
      addAliases(db, Number(twin.id), product);
      db.prepare("UPDATE catalog_products SET last_seen = ?, active = 1, missed_runs = 0 WHERE id = ?").run(
        stamp,
        Number(twin.id),
      );
      return { status: "gelijk", pending: 0 };
    }
    const columns = [...COLUMNS, "content_hash", "first_seen", "last_seen", "updated_at", "active", "missed_runs"];
    const values = [
      ...COLUMNS.map((column) => row[column] ?? null),
      hash, stamp, stamp, stamp, 1, 0,
    ];
    const result = db.prepare(
      `INSERT INTO catalog_products (source_id, ${columns.join(", ")}) VALUES (?, ${columns.map(() => "?").join(", ")})`,
    ).run(sourceId, ...values);
    addAliases(db, Number(result.lastInsertRowid), product);
    return { status: "nieuw", pending: 0 };
  }

  if (existing.content_hash === hash) {
    if (!DRY_RUN) {
      db.prepare(
        "UPDATE catalog_products SET last_seen = ?, active = 1, missed_runs = 0 WHERE id = ?",
      ).run(stamp, existing.id);
    }
    return { status: "gelijk", pending: 0 };
  }

  // Per veld bepalen of het mee mag of moet wachten.
  const updates = {};
  const changes = [];
  const pendingKeys = [];
  const storedAnalysis = (() => {
    try {
      return JSON.parse(String(existing.analysis_json ?? "{}"));
    } catch {
      return {};
    }
  })();

  for (const column of COLUMNS) {
    const nieuw = row[column] ?? null;
    const oud = existing[column] ?? null;
    if (column === "external_id" || column === "url") continue;
    if (sameValue(oud, nieuw)) continue;

    if (NUMERIC_FIELDS.has(column)) {
      if (nieuw === null) continue; // nooit een getal wissen
      const oudNum = typeof oud === "number" ? oud : oud === null ? null : Number(oud);
      if (oudNum === null || oudNum === 0) {
        updates[column] = nieuw;
        changes.push({ field: column, old: oud, new: nieuw, status: "overgenomen" });
        continue;
      }
      const afwijking = Math.abs(Number(nieuw) - Number(oudNum)) / Math.abs(Number(oudNum));
      if (afwijking <= CHANGE_THRESHOLD) {
        updates[column] = nieuw;
        changes.push({ field: column, old: oud, new: nieuw, status: "overgenomen" });
      } else {
        changes.push({ field: column, old: oud, new: nieuw, status: "wacht" });
        pendingKeys.push(ANALYSIS_KEY[column]);
      }
      continue;
    }

    // Gewicht nooit met leeg overschrijven; al het andere nemen we over.
    if (column === "weight_g" && nieuw === null) continue;
    updates[column] = nieuw;
    changes.push({ field: column, old: oud, new: nieuw, status: "overgenomen" });
  }

  // De analyse-JSON mag de kolommen niet tegenspreken: wachtende waarden zetten
  // we terug op wat er al stond.
  if (pendingKeys.length > 0 && updates.analysis_json) {
    const analysis = { ...JSON.parse(String(updates.analysis_json)) };
    for (const key of pendingKeys) {
      if (storedAnalysis[key] === undefined) delete analysis[key];
      else analysis[key] = storedAnalysis[key];
    }
    updates.analysis_json = JSON.stringify(analysis);
  }

  if (DRY_RUN) {
    return { status: pendingKeys.length ? "wacht" : "gewijzigd", pending: pendingKeys.length, changes };
  }

  updates.last_seen = stamp;
  updates.updated_at = stamp;
  updates.content_hash = hash;
  updates.active = 1;
  updates.missed_runs = 0;

  const assignments = Object.keys(updates).map((column) => `${column} = ?`).join(", ");
  db.prepare(`UPDATE catalog_products SET ${assignments} WHERE id = ?`).run(
    ...Object.values(updates),
    existing.id,
  );

  const logChange = db.prepare(
    `INSERT INTO catalog_changes (product_id, run_id, field, old_value, new_value, status, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const change of changes) {
    logChange.run(
      existing.id,
      runId,
      change.field,
      change.old === null || change.old === undefined ? null : String(change.old),
      change.new === null || change.new === undefined ? null : String(change.new),
      change.status,
      stamp,
    );
  }

  return { status: pendingKeys.length ? "wacht" : "gewijzigd", pending: pendingKeys.length, changes };
}

/** Minimale robots.txt-toets: geldt er een Disallow voor ons pad? */
async function robotsAllows(baseUrl, paths) {
  try {
    const response = await fetch(new URL("/robots.txt", baseUrl), { headers: HEADERS });
    if (!response.ok) return { ok: true, reason: `robots.txt ${response.status}` };
    const text = await response.text();
    let applies = false;
    const disallow = [];
    const allow = [];
    for (const raw of text.split("\n")) {
      const line = raw.split("#")[0].trim();
      if (!line || !line.includes(":")) continue;
      const key = line.slice(0, line.indexOf(":")).trim().toLowerCase();
      const value = line.slice(line.indexOf(":") + 1).trim();
      if (key === "user-agent") applies = value === "*";
      else if (applies && key === "disallow") disallow.push(value);
      else if (applies && key === "allow") allow.push(value);
    }
    const blocked = paths.filter(
      (target) =>
        disallow.some((rule) => rule && target.startsWith(rule)) &&
        !allow.some((rule) => rule && target.startsWith(rule)),
    );
    return blocked.length
      ? { ok: false, reason: `Disallow ${blocked.join(", ")}` }
      : { ok: true, reason: disallow.length ? `regels: ${disallow.join(", ")}` : "geen beperkingen" };
  } catch (error) {
    return { ok: true, reason: `robots.txt onleesbaar (${error.message})` };
  }
}

/** Alle producten uit de sitemap (snel en compleet, in plaats van categoriepagina's). */
async function discoverFromSitemap(baseUrl) {
  const response = await fetch(new URL("/sitemap.xml", baseUrl), { headers: HEADERS });
  if (!response.ok) throw new Error(`sitemap ${response.status}`);
  const xml = await response.text();
  const slugs = new Set();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const pathname = match[1].trim().replace(/^https?:\/\/[^/]+/, "");
    const hit = pathname.match(/^\/product\/([a-z0-9][a-z0-9-]*)\/?$/i);
    if (hit) slugs.add(hit[1]);
  }
  return [...slugs].sort();
}

async function fetchPage(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      // response.url is de eind-URL na redirects: darf.nl stuurt korte slugs
      // (bijv. /product/alroda-geit) door naar de volledige productpagina.
      return { status: response.status, html: response.ok ? await response.text() : "", finalUrl: response.url };
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(1000 * (attempt + 1) ** 2);
    }
  }
  return { status: 0, html: "", finalUrl: url };
}

/** Slug uit een product-URL (/product/<slug>), anders null. */
function slugFromUrl(url) {
  const match = String(url ?? "").match(/\/product\/([a-z0-9][a-z0-9-]*)\/?$/i);
  return match ? match[1] : null;
}

function startRun(db, sourceId, message) {
  // Een vorige run die niet is afgesloten (crash, kill) blijft anders voor
  // altijd op 'loopt' staan.
  db.prepare(
    "UPDATE catalog_runs SET status = 'onderbroken', finished_at = ?, message = 'vorige run niet afgesloten' WHERE status = 'loopt'",
  ).run(now());
  const result = db
    .prepare("INSERT INTO catalog_runs (source_id, started_at, status, message) VALUES (?, ?, 'loopt', ?)")
    .run(sourceId, now(), message);
  return Number(result.lastInsertRowid);
}

function finishRun(db, runId, counts, status, message) {
  db.prepare(
    `UPDATE catalog_runs
        SET finished_at = ?, status = ?, found = ?, new_count = ?, changed = ?, unchanged = ?, errors = ?, message = ?
      WHERE id = ?`,
  ).run(
    now(),
    status,
    counts.found,
    counts.new,
    counts.changed,
    counts.unchanged,
    counts.errors,
    message,
    runId,
  );
  db.prepare("UPDATE catalog_sources SET last_run_at = ?, last_status = ? WHERE id = ?").run(
    now(),
    status,
    counts.sourceId,
  );
}

function printStats(db) {
  const total = db.prepare("SELECT COUNT(*) AS n FROM catalog_products").get().n;
  const active = db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE active = 1").get().n;
  const withCa = db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE calcium IS NOT NULL").get().n;
  const withP = db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE fosfor IS NOT NULL").get().n;
  const withE = db.prepare("SELECT COUNT(*) AS n FROM catalog_products WHERE energie IS NOT NULL").get().n;
  const pending = db.prepare("SELECT COUNT(*) AS n FROM catalog_changes WHERE status = 'wacht'").get().n;
  console.log(`catalogus: ${total} producten (${active} actief)`);
  console.log(`  calcium ${withCa} · fosfor ${withP} · energie ${withE} · wachtend ${pending}`);
  for (const row of db
    .prepare(
      `SELECT s.source_key AS k, COUNT(p.id) AS n
         FROM catalog_sources s LEFT JOIN catalog_products p ON p.source_id = s.id
        GROUP BY s.id ORDER BY n DESC`,
    )
    .all()) {
    console.log(`  ${row.k}: ${row.n}`);
  }
  const run = db.prepare("SELECT * FROM catalog_runs ORDER BY id DESC LIMIT 1").get();
  if (run) {
    console.log(
      `  laatste run: ${run.started_at} · ${run.status} · gevonden ${run.found} · nieuw ${run.new_count} · gewijzigd ${run.changed} · fouten ${run.errors}`,
    );
  }
}

function listPending(db) {
  const rows = db
    .prepare(
      `SELECT c.id, c.field, c.old_value, c.new_value, c.changed_at, p.name
         FROM catalog_changes c JOIN catalog_products p ON p.id = c.product_id
        WHERE c.status = 'wacht' ORDER BY c.id`,
    )
    .all();
  if (rows.length === 0) {
    console.log("Geen wachtende wijzigingen.");
    return;
  }
  console.log(`${rows.length} wachtende wijziging(en):`);
  for (const row of rows) {
    console.log(`  #${row.id}  ${row.name} · ${row.field}: ${row.old_value} -> ${row.new_value} (${row.changed_at})`);
  }
  console.log("\nGoedkeuren: --approve <id> · afkeuren: --reject <id>");
}

function decide(db, id, decision) {
  const change = db
    .prepare("SELECT c.*, p.name FROM catalog_changes c JOIN catalog_products p ON p.id = c.product_id WHERE c.id = ?")
    .get(id);
  if (!change) {
    console.error(`Geen wijziging #${id}.`);
    process.exit(1);
  }
  if (change.status !== "wacht") {
    console.error(`Wijziging #${id} is al ${change.status}.`);
    process.exit(1);
  }

  if (decision === "overgenomen") {
    const product = db
      .prepare("SELECT calcium, fosfor, energie, analysis_json FROM catalog_products WHERE id = ?")
      .get(change.product_id);
    const value = change.new_value === null ? null : Number(change.new_value);

    if (NUMERIC_FIELDS.has(change.field)) {
      const analysis = JSON.parse(String(product.analysis_json ?? "{}"));
      const key = ANALYSIS_KEY[change.field];
      if (value === null) delete analysis[key];
      else analysis[key] = value;
      product[change.field] = value;
      db.prepare(
        "UPDATE catalog_products SET calcium = ?, fosfor = ?, energie = ?, analysis_json = ?, updated_at = ? WHERE id = ?",
      ).run(product.calcium, product.fosfor, product.energie, JSON.stringify(analysis), now(), change.product_id);
    } else if (["weight_g", "price_cents"].includes(change.field)) {
      db.prepare(`UPDATE catalog_products SET ${change.field} = ?, updated_at = ? WHERE id = ?`).run(
        value,
        now(),
        change.product_id,
      );
    }
  }

  db.prepare("UPDATE catalog_changes SET status = ? WHERE id = ?").run(decision, id);
  console.log(`#${id} ${change.name} · ${change.field}: ${change.old_value} -> ${change.new_value} ${decision}.`);
}

/** Kleine RFC4180-parser; de app-CSV is gequote waar nodig. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => Object.fromEntries(header.map((key, index) => [key.trim(), cells[index]])));
}

/**
 * Dataset-bron: generieke ingrediënten uit data/ingredient-nutrition.csv
 * (NU → "USDA SR Legacy 2018"). Zelfde weg als de webscanner: upsert, wijzigingen
 * loggen, aliassen voor het zoekveld.
 */
function importIngredients(db, source, runId, counts) {
  const file = path.join(process.cwd(), "data", "ingredient-nutrition.csv");
  if (!fs.existsSync(file)) {
    console.error(`Ontbreekt: ${file}`);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  console.log(`ingrediënten: ${rows.length} inlezen uit ${path.basename(file)}`);
  for (const row of rows) {
    const calcium = Number(row.calcium);
    const fosfor = Number(row.fosfor);
    const energie = Number(row.energie);
    const product = {
      slug: `usda-${row.fdc_id}`,
      url: `https://fdc.nal.usda.gov/food-details/${row.fdc_id}/nutrients`,
      brand: "USDA",
      name: row.naam,
      aliases: row.aliassen,
      animal: "BEIDE",
      flavor: "",
      part: "",
      wholeAnimal: false,
      weightG: null,
      priceCents: null,
      available: true,
      ingredients: "",
      description: `${row.bron_detail}: ${row.usda_naam}`,
      composition: [],
      analysis: {
        calcium: Number.isFinite(calcium) ? calcium : null,
        fosfor: Number.isFinite(fosfor) ? fosfor : null,
        energieKcalPer100g: Number.isFinite(energie) ? energie : null,
        eiwit: Number(row.eiwit),
        vet: Number(row.vet),
      },
      energieBron: "opgave",
    };
    const result = upsertProduct(db, { sourceId: source.id, runId, product });
    counts.found += 1;
    if (result.status === "nieuw") counts.new += 1;
    else if (result.status === "gelijk") counts.unchanged += 1;
    else counts.changed += 1;
  }
}

async function main() {
  const db = openDb();

  if (flag("stats")) {
    printStats(db);
    return;
  }
  if (flag("list-pending")) {
    listPending(db);
    return;
  }
  if (flag("refresh-aliases")) {
    const rows = db.prepare("SELECT id, external_id, brand, name FROM catalog_products").all();
    for (const row of rows) {
      addAliases(db, Number(row.id), { slug: row.external_id, brand: row.brand, name: row.name });
    }
    const count = db.prepare("SELECT COUNT(*) AS n FROM catalog_aliases").get().n;
    console.log(`${rows.length} producten · ${count} aliassen`);
    return;
  }
  const approve = option("approve");
  const reject = option("reject");
  if (approve) return decide(db, Number.parseInt(approve, 10), "overgenomen");
  if (reject) return decide(db, Number.parseInt(reject, 10), "afgekeurd");

  acquireLock();

  const source = sourceRow(db, SOURCE);
  const counts = { found: 0, new: 0, changed: 0, unchanged: 0, errors: 0, notFound: 0 };
  const runId = DRY_RUN ? null : startRun(db, source.id, `bron ${SOURCE}`);
  const started = Date.now();

  // 1. Bestaande snapshot inlezen (geen netwerk, wel meteen 130 producten).
  if (flag("import-snapshot")) {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      console.error(`Ontbreekt: ${SNAPSHOT_FILE}`);
      process.exit(1);
    }
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
    console.log(`snapshot: ${snapshot.length} producten inlezen`);
    for (const entry of snapshot) {
      const product = {
        ...entry,
        wholeAnimal: Boolean(entry.wholeAnimal),
        analysis: entry.analysis ?? {},
      };
      const result = upsertProduct(db, { sourceId: source.id, runId, product });
      counts.found += 1;
      if (result.status === "nieuw") counts.new += 1;
      else if (result.status === "gelijk" || result.status === "wacht") counts.unchanged += 1;
      else counts.changed += 1;
    }
  }

  // 2a. Dataset-bronnen (geen netwerk, wel dezelfde administratie).
  if (source.source_key === "usda") {
    importIngredients(db, source, runId, counts);
    const status = counts.errors > 0 ? "gedeeltelijk" : "ok";
    if (runId) finishRun(db, runId, { ...counts, sourceId: source.id }, status, "dataset usda");
    console.log(
      `\nklaar · gevonden ${counts.found} · nieuw ${counts.new} · gewijzigd ${counts.changed} · gelijk ${counts.unchanged}`,
    );
    printStats(db);
    return;
  }

  // 2. De bron zelf langs.
  if (!flag("import-snapshot") || flag("also-scan")) {
    const probe = await robotsAllows(DARF_BASE, ["/product/"]);
    console.log(`robots.txt: ${probe.ok ? "ok" : "GEBLOKKEERD"} (${probe.reason})`);
    if (!probe.ok) {
      if (runId) finishRun(db, runId, { ...counts, sourceId: source.id }, "fout", probe.reason);
      process.exit(1);
    }

    const slugs = await discoverFromSitemap(DARF_BASE);
    console.log(`sitemap: ${slugs.length} productpagina's`);
    // --only=<slug,slug> voor een gerichte run (bijv. na een goedkeuring).
    const only = (option("only", "") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const queue = only.length > 0 ? only : LIMIT > 0 ? slugs.slice(0, LIMIT) : slugs;
    console.log(
      `verwerken: ${queue.length}${only.length > 0 ? " (--only)" : LIMIT > 0 ? " (--limit)" : ""} · ${DELAY} ms tussen verzoeken`,
    );

    const seen = new Set();
    for (const [index, slug] of queue.entries()) {
      if (index > 0) await sleep(DELAY);
      const url = `${DARF_BASE}/product/${slug}`;
      try {
        const { status, html, finalUrl } = await fetchPage(url);
        counts.found += 1;
        if (status === 404) {
          counts.notFound += 1;
          if (!DRY_RUN) {
            db.prepare("UPDATE catalog_products SET available = 0, updated_at = ? WHERE source_id = ? AND external_id = ?").run(now(), source.id, slug);
          }
          log(`  404 ${slug}`);
          continue;
        }
        if (status !== 200) {
          counts.errors += 1;
          console.error(`  HTTP ${status} ${slug}`);
          continue;
        }

        // Doorverwijzingen: de korte slug van de sitemap hoort bij het volledige
        // product. Die schrijven we op de canonieke slug en bewaren de korte
        // slug als alias, zodat er geen dubbel product ontstaat.
        const finalSlug = slugFromUrl(finalUrl) ?? slug;
        const product = productFromDetail({ slug: finalSlug, url: finalUrl, detail: parseDetail(html) });
        seen.add(finalSlug);
        const result = upsertProduct(db, { sourceId: source.id, runId, product });
        if (finalSlug !== slug && !DRY_RUN) {
          const row = db
            .prepare("SELECT id FROM catalog_products WHERE source_id = ? AND external_id = ?")
            .get(source.id, finalSlug);
          if (row) {
            db.prepare("INSERT OR IGNORE INTO catalog_aliases (product_id, alias) VALUES (?, ?)").run(row.id, slug);
          }
        }
        if (result.status === "nieuw") counts.new += 1;
        else if (result.status === "gelijk") counts.unchanged += 1;
        else counts.changed += 1;
        if (result.status === "nieuw" || result.status === "wacht" || result.pending) {
          log(
            `  ${result.status.padEnd(9)} ${finalSlug}${finalSlug !== slug ? ` (via ${slug})` : ""}` +
              (result.changes?.length
                ? ` (${result.changes.filter((c) => c.status === "overgenomen").length} overgenomen, ${result.pending} wachtend)`
                : ""),
          );
        }
      } catch (error) {
        counts.errors += 1;
        console.error(`  fout ${slug}: ${error.message}`);
      }
      if ((index + 1) % 25 === 0) console.log(`  ${index + 1}/${queue.length} gehad`);
    }

    // Verdwenen producten: pas na MISS_LIMIT runs op inactief. Alleen bij een
    // volledige run, anders zou een --limit de rest ten onrechte afschrijven.
    if (LIMIT === 0 && only.length === 0 && !DRY_RUN && seen.size > 0) {
      const rows = db
        .prepare("SELECT id, external_id, missed_runs FROM catalog_products WHERE source_id = ?")
        .all(source.id);
      let deactivated = 0;
      const bump = db.prepare("UPDATE catalog_products SET missed_runs = ?, active = ? WHERE id = ?");
      for (const row of rows) {
        if (seen.has(row.external_id)) continue;
        const missed = Number(row.missed_runs ?? 0) + 1;
        const active = missed >= MISS_LIMIT ? 0 : 1;
        bump.run(missed, active, row.id);
        if (active === 0) deactivated += 1;
      }
      if (deactivated > 0) console.log(`  ${deactivated} product(en) na ${MISS_LIMIT} gemiste runs op inactief gezet`);
    }
  }

  const status = counts.errors > 0 ? "gedeeltelijk" : "ok";
  if (runId) finishRun(db, runId, { ...counts, sourceId: source.id }, status, `bron ${SOURCE}`);
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(
    `\nklaar in ${seconds}s · gevonden ${counts.found} · nieuw ${counts.new} · gewijzigd ${counts.changed} · gelijk ${counts.unchanged} · niet gevonden ${counts.notFound} · fouten ${counts.errors}`,
  );
  printStats(db);

  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(
    LOG_FILE,
    `${now()} ${SOURCE} status=${status} gevonden=${counts.found} nieuw=${counts.new} gewijzigd=${counts.changed} gelijk=${counts.unchanged} nietgevonden=${counts.notFound} fouten=${counts.errors} ${seconds}s\n`,
  );
}

await main();
