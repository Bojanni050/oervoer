import type { AdviceResult } from "./advice";

export type Dier = "KAT" | "HOND";
export type Portie = "beide" | "kleine porties" | "grote porties";
export type PackageKind = "100" | "PLUS" | "COMBI";
export type OrderStatus = "nieuw" | "picklist" | "afgerond";

export interface Product {
  sku: string;
  name: string;
  smaak: string;
  typeVlees: string;
  shelf: string;
  weight: number; // kg per verpakking
  verpaktPer: number;
  qty: number;
  inStock: boolean;
  geschiktMenu: boolean;
  geschiktVoor: string;
  normWeight: number; // weight / verpaktPer
  /** g calcium per 100 g product; null = onbekend, dan geldt de terugval per vleestype. */
  calcium?: number | null;
  /** g fosfor per 100 g product; null = onbekend. */
  fosfor?: number | null;
  /** kcal per 100 g product; null = onbekend (dan kan er niet per 1000 kcal gerekend worden). */
  energie?: number | null;
}

export interface OrderRecord {
  id: number;
  owner: string;
  animal: string;
  geslacht: string;
  gecastreerd: string;
  actief: string;
  overgangs: string;
  weight: number;
  packageKg: number;
  kind: PackageKind;
  pup: boolean;
  ras: Dier;
  donts: string[];
  prefers: string[];
  portie: Portie;
  factor: number;
  status: OrderStatus;
  notes: string;
  createdAt: string;
}

export interface PicklistItem {
  sku: string;
  name: string;
  smaak: string;
  typeVlees: string;
  shelf: string;
  weight: number; // kg per stuk
  count: number;
  totalKg: number;
  /** g calcium per 100 g product; oudere picklijsten hebben dit nog niet. */
  calcium?: number | null;
  /** g fosfor per 100 g product; oudere picklijsten hebben dit nog niet. */
  fosfor?: number | null;
  /** kcal per 100 g product; oudere picklijsten hebben dit nog niet. */
  energie?: number | null;
}

export interface PicklistWarning {
  type: string;
  message: string;
}

export interface PicklistRecord {
  id: number;
  orderId: number;
  items: PicklistItem[];
  warnings: PicklistWarning[];
  totalKg: number;
  mealSize: number;
  days: number;
  createdAt: string;
}

export interface AdviceRecord {
  id: string;
  animal: string;
  ras: Dier;
  weight: number;
  pup: boolean;
  portie: Portie;
  kind: PackageKind;
  packageKg: number;
  donts: string[];
  likes: string[];
  result: AdviceResult;
  userId: number | null;
  petId: number | null;
  createdAt: string;
}

export type UserRole = "user" | "admin";

export interface UserRecord {
  id: number;
  publicId: string;
  email: string;
  name: string;
  photoId: string | null;
  role: UserRole;
  createdAt: string;
}

export interface DietItemRecord {
  id: number;
  petId: number | null;
  userId: number | null;
  day: string;
  name: string;
  grams: number;
  calcium: number | null;
  fosfor: number | null;
  energie: number | null;
  eiwit: number | null;
  vet: number | null;
  bron: string;
  catalogId: number | null;
  createdAt: string;
}

export interface DietDayRecord {
  day: string;
  items: number;
  grams: number;
  calcium: number;
  fosfor: number;
  energie: number;
  eiwit: number;
  vet: number;
}

export interface DietReportRecord {
  id: string;
  petName: string;
  ras: Dier;
  pup: boolean;
  day: string;
  items: unknown[];
  totals: unknown;
  createdAt: string;
}

export interface PetRecord {
  id: number;
  publicId: string;
  userId: number;
  name: string;
  ras: Dier;
  weight: number;
  pup: boolean;
  portie: Portie;
  donts: string[];
  photoId: string | null;
  notes: string;
  createdAt: string;
}

export interface ProductRow {
  store: string;
  sku: string;
  qty: string;
  is_in_stock: string;
  geschiktmenu: string;
  name: string;
  smaak: string;
  type_vlees: string;
  shelf: string;
  weight: string;
  verpakt_per: string;
  "geschikt voor"?: string;
  /** Optioneel: g calcium per 100 g product (anders geldt de terugval per vleestype). */
  calcium?: string;
  /** Optioneel: g fosfor per 100 g product. */
  fosfor?: string;
  /** Optioneel: kcal per 100 g product, nodig voor de omrekening per 1000 kcal. */
  energie?: string;
}
