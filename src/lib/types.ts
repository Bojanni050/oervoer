import type { AdviceResult } from "./advice";

export type Dier = "KAT" | "HOND";
export type Portie = "beide" | "kleine porties" | "grote porties";
export type PackageKind = "100" | "PLUS" | "COMBI";
export type OrderStatus = "nieuw" | "picklist" | "afgerond";

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
