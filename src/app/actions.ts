"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createOrder,
  deleteOrder,
  discardPicklist,
  generateForOrder,
  setProductQty,
  updateOrderStatus,
} from "@/lib/db";

export type FormState = { error?: string };

function parseList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function createOrderAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let orderId: number;
  try {
    orderId = createOrder({
      owner: String(formData.get("owner") ?? ""),
      animal: String(formData.get("animal") ?? ""),
      weight: Number(formData.get("weight")),
      packageKg: Number(formData.get("packageKg")),
      kind: String(formData.get("kind") ?? "100"),
      ras: String(formData.get("ras") ?? "HOND"),
      portie: String(formData.get("portie") ?? "beide"),
      donts: parseList(formData.get("donts")),
      prefers: parseList(formData.get("prefers")),
      notes: String(formData.get("notes") ?? ""),
      pup: formData.get("pup") === "on",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Order opslaan mislukt." };
  }

  revalidatePath("/");
  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function generateAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get("orderId"));
  if (!Number.isFinite(orderId)) return;

  let problem = "";
  try {
    generateForOrder(orderId);
  } catch (error) {
    problem = error instanceof Error ? error.message : "Picklijst genereren mislukt.";
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/voorraad");

  if (problem) {
    redirect(`/orders/${orderId}?fout=${encodeURIComponent(problem)}`);
  }
  redirect(`/orders/${orderId}`);
}

export async function discardPicklistAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get("orderId"));
  if (!Number.isFinite(orderId)) return;
  discardPicklist(orderId);
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/voorraad");
  redirect(`/orders/${orderId}`);
}

export async function deleteOrderAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get("orderId"));
  if (!Number.isFinite(orderId)) return;
  deleteOrder(orderId);
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/voorraad");
  redirect("/orders");
}

export async function markDoneAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get("orderId"));
  if (!Number.isFinite(orderId)) return;
  updateOrderStatus(orderId, "afgerond");
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function setQtyAction(formData: FormData): Promise<void> {
  const sku = String(formData.get("sku") ?? "");
  const qty = Number(formData.get("qty"));
  if (!sku || !Number.isFinite(qty)) return;
  setProductQty(sku, qty);
  revalidatePath("/voorraad");
  revalidatePath("/");
}

export async function adjustQtyAction(formData: FormData): Promise<void> {
  const sku = String(formData.get("sku") ?? "");
  const delta = Number(formData.get("delta"));
  const current = Number(formData.get("current"));
  if (!sku || !Number.isFinite(delta)) return;
  setProductQty(sku, (Number.isFinite(current) ? current : 0) + delta);
  revalidatePath("/voorraad");
  revalidatePath("/");
}
