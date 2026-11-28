import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildAdvice, type AdviceInput, type AdviceResult } from "./advice";
import { ensureCatalogSchema } from "./catalog";
import { parseCsvObjects } from "./csv";
import type {
  AdviceRecord,
  DietDayRecord,
  DietItemRecord,
  DietReportRecord,
  Dier,
  OrderRecord,
  OrderStatus,
  PackageKind,
  PetRecord,
  Portie,
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

    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_pets_user ON pets(user_id);

    -- Dieetdagboek: wat een baasje per dag voert, met de waarden van dat moment
    -- (een latere cataloguswijziging mag het verleden niet veranderen).
    CREATE TABLE IF NOT EXISTS diet_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      name TEXT NOT NULL,
      grams REAL NOT NULL,
      calcium REAL,
      fosfor REAL,
      energie REAL,
      eiwit REAL,
      vet REAL,
      bron TEXT NOT NULL DEFAULT '',
      catalog_id INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diet_reports (
      id TEXT PRIMARY KEY,
      pet_name TEXT NOT NULL DEFAULT '',
      ras TEXT NOT NULL DEFAULT 'HOND',
      pup INTEGER NOT NULL DEFAULT 0,
      day TEXT NOT NULL,
      items_json TEXT NOT NULL,
      totals_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Migratie voor bestaande databases van vóór de accountfunctionaliteit.
  addColumnIfMissing(db, "advices", "user_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "advices", "pet_id", "INTEGER REFERENCES pets(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "users", "role", "TEXT NOT NULL DEFAULT 'user'");
  addColumnIfMissing(db, "advices", "likes", "TEXT NOT NULL DEFAULT '[]'");
  db.exec("CREATE INDEX IF NOT EXISTS idx_advices_user ON advices(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_diet_items_pet_day ON diet_items(pet_id, day)");


  globalThis.__oervoerDb = db;
  ensureCatalogSchema(db);
  seedIfEmpty(db);
  return db;
}

/** Toegang tot dezelfde verbinding voor modules die zelf geen db openen. */
export function database(): DatabaseSync {
  return openDb();
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
  // Geen eigen productcatalogus meer: voorraad, picklijsten en de seed daarvoor
  // zijn verwijderd. Alleen de voorbeeldorders blijven.
  const orders = Number((db.prepare("SELECT COUNT(*) AS n FROM orders").get() as SqlRow).n);
  if (orders === 0) seedOrders(db);
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
  db.prepare("DELETE FROM orders WHERE id = ?").run(id);
}

export function updateOrderStatus(id: number, status: OrderStatus): void {
  const db = openDb();
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
}

/* ------------------------------------------------------------------ */
/* Picklijsten                                                        */
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
  doneToday: number;
  advices: number;
  catalogProducts: number;
  catalogWithCalcium: number;
}

/**
 * Cijfers voor het beheer-dashboard. Sinds het verdwijnen van voorraad en
 * picklijsten telt het dashboard orders, adviezen en de catalogus.
 */
export function dashboardStats(): DashboardStats {
  const db = openDb();
  const vandaag = new Date().toISOString().slice(0, 10);
  const one = (sql: string, ...params: Array<string | number>): number =>
    Number((db.prepare(sql).get(...params) as SqlRow | undefined)?.n ?? 0);

  return {
    openOrders: one("SELECT COUNT(*) AS n FROM orders WHERE status <> 'afgerond'"),
    doneToday: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'afgerond' AND created_at LIKE ?", `${vandaag}%`),
    advices: one("SELECT COUNT(*) AS n FROM advices"),
    catalogProducts: one("SELECT COUNT(*) AS n FROM catalog_products WHERE active = 1"),
    catalogWithCalcium: one("SELECT COUNT(*) AS n FROM catalog_products WHERE active = 1 AND calcium IS NOT NULL"),
  };
}

function mapDietItem(row: SqlRow): DietItemRecord {
  const num = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value);
  return {
    id: Number(row.id),
    petId: row.pet_id === null || row.pet_id === undefined ? null : Number(row.pet_id),
    userId: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
    day: String(row.day),
    name: String(row.name),
    grams: Number(row.grams),
    calcium: num(row.calcium),
    fosfor: num(row.fosfor),
    energie: num(row.energie),
    eiwit: num(row.eiwit),
    vet: num(row.vet),
    bron: String(row.bron ?? ""),
    catalogId:
      row.catalog_id === null || row.catalog_id === undefined ? null : Number(row.catalog_id),
    createdAt: String(row.created_at),
  };
}

export interface NewDietItem {
  petId: number | null;
  userId: number | null;
  day: string;
  name: string;
  grams: number;
  calcium: number | null;
  fosfor: number | null;
  energie: number | null;
  eiwit?: number | null;
  vet?: number | null;
  bron?: string;
  catalogId?: number | null;
}

export function addDietItem(input: NewDietItem): number {
  const db = openDb();
  const result = db
    .prepare(
      `INSERT INTO diet_items
        (pet_id, user_id, day, name, grams, calcium, fosfor, energie, eiwit, vet, bron, catalog_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.petId,
      input.userId,
      input.day,
      input.name.trim(),
      input.grams,
      input.calcium,
      input.fosfor,
      input.energie,
      input.eiwit ?? null,
      input.vet ?? null,
      (input.bron ?? "").trim(),
      input.catalogId ?? null,
      new Date().toISOString(),
    );
  return Number(result.lastInsertRowid);
}

export function listDietItems(petId: number, day?: string): DietItemRecord[] {
  const db = openDb();
  const rows = day
    ? (db
        .prepare("SELECT * FROM diet_items WHERE pet_id = ? AND day = ? ORDER BY id")
        .all(petId, day) as SqlRow[])
    : (db
        .prepare("SELECT * FROM diet_items WHERE pet_id = ? ORDER BY day DESC, id")
        .all(petId) as SqlRow[]);
  return rows.map(mapDietItem);
}

/** Eén regel per dag, met de totalen van die dag. */
export function listDietDays(petId: number, limit = 30): DietDayRecord[] {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT day,
              COUNT(*) AS items,
              SUM(grams) AS grams,
              SUM(COALESCE(calcium, 0) * grams / 100.0) AS calcium,
              SUM(COALESCE(fosfor, 0) * grams / 100.0) AS fosfor,
              SUM(COALESCE(energie, 0) * grams / 100.0) AS energie,
              SUM(COALESCE(eiwit, 0) * grams / 100.0) AS eiwit,
              SUM(COALESCE(vet, 0) * grams / 100.0) AS vet
         FROM diet_items
        WHERE pet_id = ?
        GROUP BY day
        ORDER BY day DESC
        LIMIT ?`,
    )
    .all(petId, limit) as SqlRow[];
  return rows.map((row) => ({
    day: String(row.day),
    items: Number(row.items),
    grams: Number(row.grams ?? 0),
    calcium: Number(row.calcium ?? 0),
    fosfor: Number(row.fosfor ?? 0),
    energie: Number(row.energie ?? 0),
    eiwit: Number(row.eiwit ?? 0),
    vet: Number(row.vet ?? 0),
  }));
}

export function deleteDietItem(id: number, userId: number): boolean {
  const db = openDb();
  const result = db
    .prepare("DELETE FROM diet_items WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return Number(result.changes) > 0;
}

export interface NewDietReport {
  id: string;
  petName: string;
  ras: Dier;
  pup: boolean;
  day: string;
  items: unknown[];
  totals: unknown;
}

export function saveDietReport(input: NewDietReport): string {
  const db = openDb();
  db.prepare(
    `INSERT OR REPLACE INTO diet_reports (id, pet_name, ras, pup, day, items_json, totals_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.petName,
    input.ras,
    input.pup ? 1 : 0,
    input.day,
    JSON.stringify(input.items),
    JSON.stringify(input.totals),
    new Date().toISOString(),
  );
  return input.id;
}

export function getDietReport(id: string): DietReportRecord | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM diet_reports WHERE id = ?").get(id) as SqlRow | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    petName: String(row.pet_name ?? ""),
    ras: String(row.ras) as Dier,
    pup: Number(row.pup) === 1,
    day: String(row.day),
    items: JSON.parse(String(row.items_json ?? "[]")),
    totals: JSON.parse(String(row.totals_json ?? "{}")),
    createdAt: String(row.created_at),
  };
}
