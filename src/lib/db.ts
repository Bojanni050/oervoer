import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildAdvice, type AdviceInput, type AdviceResult } from "./advice";
import { parseCsvObjects } from "./csv";
import {
  daysFor,
  generatePicklist,
  isMenuProduct,
  mealSizeFor,
  productFromRow,
  type GenerationResult,
  type OrderInput,
} from "./picklist";
import type {
  AdviceRecord,
  Dier,
  OrderRecord,
  OrderStatus,
  PackageKind,
  PetRecord,
  PicklistItem,
  PicklistRecord,
  PicklistWarning,
  Portie,
  Product,
  ProductRow,
  UserRecord,
} from "./types";
import { PACKAGE_KINDS, PORTIES } from "./globals";

const DB_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DB_DIR, "oervoer.db");

type SqlRow = Record<string, string | number | bigint | null>;

declare global {
  // eslint-disable-next-line no-var
  var __oervoerDb: DatabaseSync | undefined;
}

function openDb(): DatabaseSync {
  if (globalThis.__oervoerDb) return globalThis.__oervoerDb;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      smaak TEXT NOT NULL DEFAULT '',
      type_vlees TEXT NOT NULL DEFAULT '',
      shelf TEXT NOT NULL DEFAULT '',
      weight REAL NOT NULL DEFAULT 0,
      verpakt_per INTEGER NOT NULL DEFAULT 1,
      qty INTEGER NOT NULL DEFAULT 0,
      in_stock INTEGER NOT NULL DEFAULT 1,
      geschikt_menu INTEGER NOT NULL DEFAULT 0,
      geschikt_voor TEXT NOT NULL DEFAULT '',
      calcium REAL,
      fosfor REAL,
      energie REAL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      animal TEXT NOT NULL,
      geslacht TEXT NOT NULL DEFAULT '',
      gecastreerd TEXT NOT NULL DEFAULT '',
      actief TEXT NOT NULL DEFAULT '',
      overgangs TEXT NOT NULL DEFAULT '',
      weight REAL NOT NULL,
      package_kg REAL NOT NULL,
      kind TEXT NOT NULL DEFAULT '100',
      pup INTEGER NOT NULL DEFAULT 0,
      ras TEXT NOT NULL DEFAULT 'HOND',
      donts TEXT NOT NULL DEFAULT '[]',
      prefers TEXT NOT NULL DEFAULT '[]',
      portie TEXT NOT NULL DEFAULT 'beide',
      factor REAL NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'nieuw',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS picklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      items TEXT NOT NULL,
      warnings TEXT NOT NULL DEFAULT '[]',
      total_kg REAL NOT NULL DEFAULT 0,
      meal_size REAL NOT NULL DEFAULT 0,
      days INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS advices (
      id TEXT PRIMARY KEY,
      animal TEXT NOT NULL DEFAULT '',
      ras TEXT NOT NULL,
      weight REAL NOT NULL,
      pup INTEGER NOT NULL DEFAULT 0,
      portie TEXT NOT NULL DEFAULT 'beide',
      kind TEXT NOT NULL,
      package_kg REAL NOT NULL,
      donts TEXT NOT NULL DEFAULT '[]',
      likes TEXT NOT NULL DEFAULT '[]',
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      ras TEXT NOT NULL DEFAULT 'HOND',
      weight REAL NOT NULL,
      pup INTEGER NOT NULL DEFAULT 0,
      portie TEXT NOT NULL DEFAULT 'beide',
      donts TEXT NOT NULL DEFAULT '[]',
      photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_picklists_order ON picklists(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_pets_user ON pets(user_id);
  `);

  // Migratie voor bestaande databases van vóór de accountfunctionaliteit.
  addColumnIfMissing(db, "advices", "user_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "advices", "pet_id", "INTEGER REFERENCES pets(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "users", "role", "TEXT NOT NULL DEFAULT 'user'");
  addColumnIfMissing(db, "advices", "likes", "TEXT NOT NULL DEFAULT '[]'");
  db.exec("CREATE INDEX IF NOT EXISTS idx_advices_user ON advices(user_id)");

  // Mineralen per product (calcium en fosfor in g per 100 g product) voor de
  // calciumberekening. Toevoegen is genoeg: bestaande databases krijgen de
  // kolommen erbij en de waarden komen uit data/product-nutrition.csv.
  addColumnIfMissing(db, "products", "calcium", "REAL");
  addColumnIfMissing(db, "products", "fosfor", "REAL");
  addColumnIfMissing(db, "products", "energie", "REAL");

  globalThis.__oervoerDb = db;
  seedIfEmpty(db);
  seedProductNutrition(db);
  return db;
}

function addColumnIfMissing(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as SqlRow[];
  if (!columns.some((entry) => String(entry.name) === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedIfEmpty(db: DatabaseSync): void {
  const count = Number((db.prepare("SELECT COUNT(*) AS n FROM products").get() as SqlRow).n);
  if (count === 0) seedProducts(db);
  const orders = Number((db.prepare("SELECT COUNT(*) AS n FROM orders").get() as SqlRow).n);
  if (orders === 0) seedOrders(db);
}

function seedProducts(db: DatabaseSync): void {
  const csvPath = path.join(process.cwd(), "test", "products.csv");
  if (!fs.existsSync(csvPath)) return;
  const rows = parseCsvObjects(fs.readFileSync(csvPath, "utf8")) as unknown as ProductRow[];
  const insert = db.prepare(`
    INSERT OR REPLACE INTO products
      (sku, name, smaak, type_vlees, shelf, weight, verpakt_per, qty, in_stock, geschikt_menu, geschikt_voor, calcium, fosfor, energie)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of rows) {
    if (!row.sku) continue;
    const product = productFromRow(row);
    insert.run(
      product.sku,
      product.name,
      product.smaak,
      product.typeVlees,
      product.shelf,
      product.weight,
      product.verpaktPer,
      product.qty,
      product.inStock ? 1 : 0,
      product.geschiktMenu ? 1 : 0,
      product.geschiktVoor,
      product.calcium ?? null,
      product.fosfor ?? null,
      product.energie ?? null,
    );
  }
}

/**
 * Vult calcium, fosfor en energie per SKU uit `data/product-nutrition.csv`
 * (kolommen `sku,calcium,fosfor,energie`). Deze waarden staan los van de
 * productbron zelf, zodat een herimport van `test/products.csv` ze niet
 * weggooit. Een SKU zonder waarde valt terug op de terugvalwaarde van zijn
 * vleestype in `src/lib/minerals.ts`.
 */
function seedProductNutrition(db: DatabaseSync): void {
  const csvPath = path.join(process.cwd(), "data", "product-nutrition.csv");
  if (!fs.existsSync(csvPath)) return;
  const rows = parseCsvObjects(fs.readFileSync(csvPath, "utf8"));
  const update = db.prepare(
    "UPDATE products SET calcium = COALESCE(?, calcium), fosfor = COALESCE(?, fosfor), energie = COALESCE(?, energie) WHERE sku = ?",
  );
  for (const row of rows) {
    const sku = String(row.sku ?? "").trim();
    if (!sku) continue;
    const calcium = parseNutritionValue(row.calcium);
    const fosfor = parseNutritionValue(row.fosfor);
    const energie = parseNutritionValue(row.energie);
    if (calcium === null && fosfor === null && energie === null) continue;
    update.run(calcium, fosfor, energie, sku);
  }
}

function parseNutritionValue(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || text === "-") return null;
  const parsed = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const SEED_ORDERS: Array<Partial<OrderRecord> & { owner: string; animal: string }> = [
  {
    owner: "Jan Pascal Grosveld",
    animal: "James",
    weight: 9,
    packageKg: 20,
    kind: "PLUS",
    ras: "HOND",
    donts: ["RUND", "MIDDEL BOT", "HARD BOT"],
  },
  {
    owner: "Marcella Pommee",
    animal: "April",
    weight: 14,
    packageKg: 10,
    kind: "100",
    ras: "HOND",
    donts: ["KIP"],
    prefers: ["EEND"],
  },
  {
    owner: "Nienke Struijk",
    animal: "Ollie",
    weight: 4.5,
    packageKg: 5,
    kind: "100",
    ras: "KAT",
    donts: [],
    prefers: ["ZALM"],
  },
  {
    owner: "Ruud Schellen",
    animal: "Lora",
    weight: 32,
    packageKg: 20,
    kind: "COMBI",
    ras: "HOND",
    donts: ["PENS"],
    prefers: ["KIP"],
    portie: "grote porties",
  },
  {
    owner: "Jennie Kemfers",
    animal: "Shiny",
    weight: 3.2,
    packageKg: 5,
    kind: "PLUS",
    ras: "KAT",
    donts: ["RUND"],
  },
  {
    owner: "Sjoerd Kaarsemaker",
    animal: "Saar",
    weight: 22,
    packageKg: 15,
    kind: "100",
    ras: "HOND",
    notes: "Graag extra vis.",
  },
];

function seedOrders(db: DatabaseSync): void {
  for (const order of SEED_ORDERS) {
    createOrder({
      owner: order.owner,
      animal: order.animal,
      weight: order.weight ?? 0,
      packageKg: order.packageKg ?? 0,
      kind: order.kind ?? "100",
      ras: order.ras ?? "HOND",
      donts: order.donts ?? [],
      prefers: order.prefers ?? [],
      portie: order.portie ?? "beide",
      factor: order.factor ?? 1,
      notes: order.notes ?? "",
      pup: order.pup ?? false,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Producten                                                          */
/* ------------------------------------------------------------------ */

function mapProduct(row: SqlRow): Product {
  const weight = Number(row.weight);
  const verpaktPer = Number(row.verpakt_per) || 1;
  return {
    sku: String(row.sku),
    name: String(row.name),
    smaak: String(row.smaak),
    typeVlees: String(row.type_vlees),
    shelf: String(row.shelf),
    weight,
    verpaktPer,
    qty: Number(row.qty),
    inStock: Number(row.in_stock) === 1,
    geschiktMenu: Number(row.geschikt_menu) === 1,
    geschiktVoor: String(row.geschikt_voor),
    normWeight: weight / verpaktPer,
    calcium: row.calcium === null || row.calcium === undefined ? null : Number(row.calcium),
    fosfor: row.fosfor === null || row.fosfor === undefined ? null : Number(row.fosfor),
    energie: row.energie === null || row.energie === undefined ? null : Number(row.energie),
  };
}

export function listProducts(): Product[] {
  const db = openDb();
  return (db.prepare("SELECT * FROM products ORDER BY type_vlees, name").all() as SqlRow[]).map(
    mapProduct,
  );
}

export function getProduct(sku: string): Product | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as SqlRow | undefined;
  return row ? mapProduct(row) : null;
}

export function setProductQty(sku: string, qty: number): void {
  const db = openDb();
  db.prepare("UPDATE products SET qty = ?, in_stock = ? WHERE sku = ?").run(
    Math.max(0, Math.trunc(qty)),
    Math.max(0, Math.trunc(qty)) > 0 ? 1 : 0,
    sku,
  );
}

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */

function mapOrder(row: SqlRow): OrderRecord {
  return {
    id: Number(row.id),
    owner: String(row.owner),
    animal: String(row.animal),
    geslacht: String(row.geslacht),
    gecastreerd: String(row.gecastreerd),
    actief: String(row.actief),
    overgangs: String(row.overgangs),
    weight: Number(row.weight),
    packageKg: Number(row.package_kg),
    kind: String(row.kind) as PackageKind,
    pup: Number(row.pup) === 1,
    ras: String(row.ras) as Dier,
    donts: safeJson<string[]>(String(row.donts), []),
    prefers: safeJson<string[]>(String(row.prefers), []),
    portie: String(row.portie) as Portie,
    factor: Number(row.factor),
    status: String(row.status) as OrderStatus,
    notes: String(row.notes),
    createdAt: String(row.created_at),
  };
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface NewOrderInput {
  owner: string;
  animal: string;
  weight: number;
  packageKg: number;
  kind: string;
  ras: string;
  donts: string[];
  prefers: string[];
  portie: string;
  factor?: number;
  notes?: string;
  pup?: boolean;
  geslacht?: string;
  gecastreerd?: string;
  actief?: string;
  overgangs?: string;
}

export function createOrder(input: NewOrderInput): number {
  const owner = input.owner.trim();
  const animal = input.animal.trim();
  if (!owner || !animal) throw new Error("Eigenaar en diernaam zijn verplicht.");
  if (!(input.weight > 0)) throw new Error("Gewicht moet groter dan 0 zijn.");
  if (!(input.packageKg > 0)) throw new Error("Pakketgewicht moet groter dan 0 zijn.");
  const ras = input.ras.toUpperCase() === "KAT" ? "KAT" : "HOND";
  const kind = (PACKAGE_KINDS as readonly string[]).includes(input.kind.toUpperCase())
    ? input.kind.toUpperCase()
    : "100";
  const portie = (PORTIES as readonly string[]).includes(input.portie) ? input.portie : "beide";
  const cleanList = (values: string[]) =>
    [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))];

  const db = openDb();
  const result = db
    .prepare(
      `INSERT INTO orders
        (owner, animal, geslacht, gecastreerd, actief, overgangs, weight, package_kg, kind, pup, ras, donts, prefers, portie, factor, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nieuw', ?, ?)`,
    )
    .run(
      owner,
      animal,
      input.geslacht ?? "",
      input.gecastreerd ?? "",
      input.actief ?? "",
      input.overgangs ?? "",
      input.weight,
      input.packageKg,
      kind,
      input.pup ? 1 : 0,
      ras,
      JSON.stringify(cleanList(input.donts)),
      JSON.stringify(cleanList(input.prefers)),
      portie,
      input.factor && input.factor > 0 ? input.factor : 1,
      (input.notes ?? "").trim(),
      new Date().toISOString(),
    );
  return Number(result.lastInsertRowid);
}

export function listOrders(filter?: { status?: OrderStatus | "alle"; search?: string }): OrderRecord[] {
  const db = openDb();
  let orders = (db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as SqlRow[]).map(
    mapOrder,
  );
  if (filter?.status && filter.status !== "alle") {
    orders = orders.filter((order) => order.status === filter.status);
  }
  const search = filter?.search?.trim().toLowerCase();
  if (search) {
    orders = orders.filter(
      (order) =>
        order.owner.toLowerCase().includes(search) ||
        order.animal.toLowerCase().includes(search) ||
        order.kind.toLowerCase().includes(search),
    );
  }
  return orders;
}

export function getOrder(id: number): OrderRecord | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as SqlRow | undefined;
  return row ? mapOrder(row) : null;
}

export function deleteOrder(id: number): void {
  const db = openDb();
  const picklist = getPicklist(id);
  if (picklist) restoreInventory(db, picklist.items);
  db.prepare("DELETE FROM picklists WHERE order_id = ?").run(id);
  db.prepare("DELETE FROM orders WHERE id = ?").run(id);
}

export function updateOrderStatus(id: number, status: OrderStatus): void {
  const db = openDb();
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
}

/* ------------------------------------------------------------------ */
/* Picklijsten                                                        */
/* ------------------------------------------------------------------ */

function mapPicklist(row: SqlRow): PicklistRecord {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    items: safeJson<PicklistItem[]>(String(row.items), []),
    warnings: safeJson<PicklistWarning[]>(String(row.warnings), []),
    totalKg: Number(row.total_kg),
    mealSize: Number(row.meal_size),
    days: Number(row.days),
    createdAt: String(row.created_at),
  };
}

export function getPicklist(orderId: number): PicklistRecord | null {
  const db = openDb();
  const row = db
    .prepare("SELECT * FROM picklists WHERE order_id = ? ORDER BY id DESC LIMIT 1")
    .get(orderId) as SqlRow | undefined;
  return row ? mapPicklist(row) : null;
}

export function listPicklists(): PicklistRecord[] {
  const db = openDb();
  return (
    db.prepare("SELECT * FROM picklists ORDER BY created_at DESC").all() as SqlRow[]
  ).map(mapPicklist);
}

function restoreInventory(db: DatabaseSync, items: PicklistItem[]): void {
  const update = db.prepare("UPDATE products SET qty = qty + ? WHERE sku = ?");
  for (const item of items) update.run(item.count, item.sku);
}

export function generateForOrder(orderId: number): PicklistRecord {
  const db = openDb();
  const order = getOrder(orderId);
  if (!order) throw new Error("Order niet gevonden.");

  const input: OrderInput = {
    ras: order.ras,
    weight: order.weight,
    packageKg: order.packageKg,
    kind: order.kind,
    donts: order.donts,
    prefers: order.prefers,
    portie: order.portie,
    factor: order.factor,
    pup: order.pup,
  };

  db.exec("BEGIN");
  try {
    const previous = getPicklist(orderId);
    if (previous) restoreInventory(db, previous.items);

    // Pas na het terugboeken van een oude picklijst lezen, zodat de voorraad klopt.
    const products = listProducts();
    const result: GenerationResult = generatePicklist(input, products);

    const stockWarnings: PicklistWarning[] = [];
    for (const item of result.items) {
      const product = products.find((candidate) => candidate.sku === item.sku);
      const available = product?.qty ?? 0;
      if (item.count > available) {
        stockWarnings.push({
          type: item.typeVlees,
          message: `Onvoldoende voorraad voor ${item.name}: ${item.count} nodig, ${available} beschikbaar.`,
        });
      }
    }

    db.prepare("DELETE FROM picklists WHERE order_id = ?").run(orderId);
    const decrement = db.prepare("UPDATE products SET qty = MAX(qty - ?, 0) WHERE sku = ?");
    for (const item of result.items) decrement.run(item.count, item.sku);

    const insert = db.prepare(
      `INSERT INTO picklists (order_id, items, warnings, total_kg, meal_size, days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const warnings = [...result.warnings, ...stockWarnings];
    insert.run(
      orderId,
      JSON.stringify(result.items),
      JSON.stringify(warnings),
      result.totalKg,
      result.mealSize,
      result.days,
      new Date().toISOString(),
    );
    db.prepare("UPDATE orders SET status = 'picklist' WHERE id = ?").run(orderId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const created = getPicklist(orderId);
  if (!created) throw new Error("Picklijst kon niet worden opgeslagen.");
  return created;
}

export function discardPicklist(orderId: number): void {
  const db = openDb();
  const picklist = getPicklist(orderId);
  if (!picklist) return;
  restoreInventory(db, picklist.items);
  db.prepare("DELETE FROM picklists WHERE order_id = ?").run(orderId);
  db.prepare("UPDATE orders SET status = 'nieuw' WHERE id = ?").run(orderId);
}

/* ------------------------------------------------------------------ */
/* Voedingsadviezen                                                   */
/* ------------------------------------------------------------------ */

export interface AdviceOwner {
  userId?: number | null;
  petId?: number | null;
}

export function createAdvice(input: AdviceInput, owner?: AdviceOwner): string {
  const db = openDb();
  const result = buildAdvice(input);
  const id = randomUUID().replace(/-/g, "").slice(0, 12);

  db.prepare(
    `INSERT INTO advices
      (id, animal, ras, weight, pup, portie, kind, package_kg, donts, likes, result, user_id, pet_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.animal?.trim() ?? "",
    input.ras,
    input.weight,
    input.pup ? 1 : 0,
    input.portie,
    input.kind,
    input.packageKg,
    JSON.stringify(input.donts),
    JSON.stringify(input.likes ?? []),
    JSON.stringify(result),
    owner?.userId ?? null,
    owner?.petId ?? null,
    new Date().toISOString(),
  );

  return id;
}

function mapAdvice(row: SqlRow): AdviceRecord {
  return {
    id: String(row.id),
    animal: String(row.animal),
    ras: String(row.ras) as Dier,
    weight: Number(row.weight),
    pup: Boolean(row.pup),
    portie: String(row.portie) as Portie,
    kind: String(row.kind) as PackageKind,
    packageKg: Number(row.package_kg),
    donts: safeJson<string[]>(String(row.donts), []),
    likes: safeJson<string[]>(String(row.likes ?? "[]"), []),
    result: safeJson<AdviceResult>(String(row.result), {} as AdviceResult),
    userId: row.user_id == null ? null : Number(row.user_id),
    petId: row.pet_id == null ? null : Number(row.pet_id),
    createdAt: String(row.created_at),
  };
}

export function listAdvicesForUser(userId: number): AdviceRecord[] {
  const db = openDb();
  return (
    db
      .prepare("SELECT * FROM advices WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as SqlRow[]
  ).map(mapAdvice);
}

export function getAdvice(id: string): AdviceRecord | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM advices WHERE id = ?").get(id) as SqlRow | undefined;
  return row ? mapAdvice(row) : null;
}

/* ------------------------------------------------------------------ */
/* Foto's, accounts en dieren                                         */
/* ------------------------------------------------------------------ */

export function savePhoto(photo: { data: Uint8Array; contentType: string }): string {
  const db = openDb();
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  db.prepare("INSERT INTO photos (id, content_type, data, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    photo.contentType,
    photo.data,
    new Date().toISOString(),
  );
  return id;
}

export function getPhoto(id: string): { contentType: string; data: Uint8Array } | null {
  const db = openDb();
  const row = db.prepare("SELECT content_type, data FROM photos WHERE id = ?").get(id) as
    | { content_type: string; data: Uint8Array }
    | undefined;
  if (!row) return null;
  return { contentType: row.content_type, data: row.data };
}

function mapUser(row: SqlRow): UserRecord {
  return {
    id: Number(row.id),
    publicId: String(row.public_id),
    email: String(row.email),
    name: String(row.name),
    photoId: row.photo_id == null ? null : String(row.photo_id),
    role: row.role === "admin" ? "admin" : "user",
    createdAt: String(row.created_at),
  };
}

export interface NewUserInput {
  name: string;
  email: string;
  passwordHash: string;
  photoId?: string | null;
}

export function createUser(input: NewUserInput): UserRecord {
  const db = openDb();
  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  try {
    const result = db
      .prepare(
        `INSERT INTO users (public_id, email, password_hash, name, photo_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.email,
        input.passwordHash,
        input.name,
        input.photoId ?? null,
        new Date().toISOString(),
      );
    const row = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as SqlRow;
    return mapUser(row);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new Error("Er bestaat al een account met dit e-mailadres.");
    }
    throw error;
  }
}

export function getUserByEmail(
  email: string,
): (UserRecord & { passwordHash: string }) | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as SqlRow | undefined;
  if (!row) return null;
  return { ...mapUser(row), passwordHash: String(row.password_hash) };
}

export function updateUserProfile(
  userId: number,
  input: { name: string; photoId?: string | null },
): void {
  const name = input.name.trim();
  if (!name) throw new Error("Vul je naam in.");
  const db = openDb();
  db.prepare("UPDATE users SET name = ?, photo_id = COALESCE(?, photo_id) WHERE id = ?").run(
    name,
    input.photoId ?? null,
    userId,
  );
}

export function createSession(userId: number, tokenHash: string, expiresAt: string): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(tokenHash, userId, expiresAt, now);
}

export function getUserBySessionHash(tokenHash: string): UserRecord | null {
  const db = openDb();
  const row = db
    .prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at >= ?`,
    )
    .get(tokenHash, new Date().toISOString()) as SqlRow | undefined;
  return row ? mapUser(row) : null;
}

export function deleteSession(tokenHash: string): void {
  openDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

function mapPet(row: SqlRow): PetRecord {
  return {
    id: Number(row.id),
    publicId: String(row.public_id),
    userId: Number(row.user_id),
    name: String(row.name),
    ras: String(row.ras) as Dier,
    weight: Number(row.weight),
    pup: Boolean(row.pup),
    portie: String(row.portie) as Portie,
    donts: safeJson<string[]>(String(row.donts), []),
    photoId: row.photo_id == null ? null : String(row.photo_id),
    notes: String(row.notes),
    createdAt: String(row.created_at),
  };
}

export interface PetInput {
  name: string;
  ras: string;
  weight: number;
  pup?: boolean;
  portie?: string;
  donts?: string[];
  photoId?: string | null;
  notes?: string;
}

function cleanPetInput(input: PetInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Vul de naam van je dier in.");
  if (!(input.weight >= 0.5 && input.weight <= 90)) {
    throw new Error("Vul een gewicht tussen 0,5 en 90 kg in.");
  }
  return {
    name,
    ras: input.ras.toUpperCase() === "KAT" ? ("KAT" as const) : ("HOND" as const),
    weight: input.weight,
    pup: input.pup ? 1 : 0,
    portie: (PORTIES as readonly string[]).includes(input.portie ?? "")
      ? (input.portie as string)
      : "beide",
    donts: [
      ...new Set((input.donts ?? []).map((value) => value.trim().toUpperCase()).filter(Boolean)),
    ],
    photoId: input.photoId ?? null,
    notes: (input.notes ?? "").trim(),
  };
}

export function listPets(userId: number): PetRecord[] {
  const db = openDb();
  return (
    db.prepare("SELECT * FROM pets WHERE user_id = ? ORDER BY created_at ASC").all(userId) as SqlRow[]
  ).map(mapPet);
}

export function getPetByPublicId(publicId: string): PetRecord | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM pets WHERE public_id = ?").get(publicId) as
    | SqlRow
    | undefined;
  return row ? mapPet(row) : null;
}

export function createPet(userId: number, input: PetInput): PetRecord {
  const clean = cleanPetInput(input);
  const db = openDb();
  const publicId = randomUUID().replace(/-/g, "").slice(0, 12);
  const result = db
    .prepare(
      `INSERT INTO pets
        (public_id, user_id, name, ras, weight, pup, portie, donts, photo_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      publicId,
      userId,
      clean.name,
      clean.ras,
      clean.weight,
      clean.pup,
      clean.portie,
      JSON.stringify(clean.donts),
      clean.photoId,
      clean.notes,
      new Date().toISOString(),
    );
  const row = db
    .prepare("SELECT * FROM pets WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as SqlRow;
  return mapPet(row);
}

export function updatePet(userId: number, publicId: string, input: PetInput): void {
  const clean = cleanPetInput(input);
  const db = openDb();
  const result = db
    .prepare(
      `UPDATE pets SET
        name = ?, ras = ?, weight = ?, pup = ?, portie = ?, donts = ?,
        photo_id = COALESCE(?, photo_id), notes = ?
       WHERE public_id = ? AND user_id = ?`,
    )
    .run(
      clean.name,
      clean.ras,
      clean.weight,
      clean.pup,
      clean.portie,
      JSON.stringify(clean.donts),
      clean.photoId,
      clean.notes,
      publicId,
      userId,
    );
  if (result.changes === 0) throw new Error("Dit dier hoort niet bij je account.");
}

export function deletePet(userId: number, publicId: string): void {
  openDb().prepare("DELETE FROM pets WHERE public_id = ? AND user_id = ?").run(publicId, userId);
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  openOrders: number;
  picklistsToday: number;
  productCount: number;
  lowStock: Product[];
  lowStockCount: number;
  totalQty: number;
}

export function dashboardStats(): DashboardStats {
  const db = openDb();
  const openOrders = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status != 'afgerond'").get() as SqlRow).n,
  );
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const picklistsToday = Number(
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM picklists WHERE created_at >= ?")
        .get(startOfDay.toISOString()) as SqlRow
    ).n,
  );
  const products = listProducts();
  const allLowStock = products
    .filter((product) => isMenuProduct(product) && product.qty < 5)
    .sort((a, b) => a.qty - b.qty);

  return {
    openOrders,
    picklistsToday,
    productCount: products.length,
    totalQty: products.reduce((sum, product) => sum + product.qty, 0),
    lowStockCount: allLowStock.length,
    lowStock: allLowStock.slice(0, 8),
  };
}

export function orderSummary(order: OrderRecord) {
  return {
    ...order,
    mealSize: Number(mealSizeFor(order).toFixed(1)),
    days: daysFor(order),
  };
}
