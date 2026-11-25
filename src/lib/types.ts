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
}
