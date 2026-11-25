import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
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
  Dier,
  OrderRecord,
  OrderStatus,
  PackageKind,
  PicklistItem,
  PicklistRecord,
  PicklistWarning,
  Portie,
  Product,
  ProductRow,
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
      geschikt_voor TEXT NOT NULL DEFAULT ''
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

    CREATE INDEX IF NOT EXISTS idx_picklists_order ON picklists(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);
  globalThis.__oervoerDb = db;
  seedIfEmpty(db);
  return db;
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
      (sku, name, smaak, type_vlees, shelf, weight, verpakt_per, qty, in_stock, geschikt_menu, geschikt_voor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    );
  }
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
