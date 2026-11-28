"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAdvice,
  createOrder,
  deleteOrder,
  getPetByPublicId,
  updateOrderStatus,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { AdviceInput } from "@/lib/advice";
import { requireAdmin } from "@/lib/auth";

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
  await requireAdmin("/beheer/orders/nieuw");
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

  revalidatePath("/beheer");
  revalidatePath("/beheer/orders");
  redirect(`/beheer/orders/${orderId}`);
}

export async function deleteOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderId = Number(formData.get("orderId"));
  if (!Number.isFinite(orderId)) return;
  deleteOrder(orderId);
  revalidatePath("/beheer");
  revalidatePath("/beheer/orders");
  redirect("/beheer/orders");
}

export async function markDoneAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderId = Number(formData.get("orderId"));
  if (!Number.isFinite(orderId)) return;
  updateOrderStatus(orderId, "afgerond");
  revalidatePath("/beheer");
  revalidatePath("/beheer/orders");
  revalidatePath(`/beheer/orders/${orderId}`);
  redirect(`/beheer/orders/${orderId}`);
}

export async function createAdviceAction(
  input: AdviceInput,
  petPublicId?: string,
): Promise<{ id?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    let petId: number | null = null;
    if (user && petPublicId) {
      const pet = getPetByPublicId(petPublicId);
      if (pet && pet.userId === user.id) petId = pet.id;
    }
    return { id: createAdvice(input, { userId: user?.id ?? null, petId }) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Advies opslaan mislukt.",
    };
  }
}
