"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, newSessionToken, requireUser } from "@/lib/auth";
import {
  addDietItem,
  deleteDietItem,
  getPetByPublicId,
  saveDietReport,
} from "@/lib/db";
import { bandFor, summariseMinerals } from "@/lib/minerals";
import type { Dier } from "@/lib/types";

/**
 * Serveracties voor de voercheck en het dieetdagboek.
 *
 * De check zelf rekent in de browser (`src/lib/voercheck.ts`); hier komt alleen
 * het bewaren: regels in het dagboek van een dier, of een deelbare momentopname.
 */

interface InkomendeRegel {
  name?: unknown;
  grams?: unknown;
  calcium?: unknown;
  fosfor?: unknown;
  energie?: unknown;
  eiwit?: unknown;
  vet?: unknown;
  bron?: unknown;
  catalogId?: unknown;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Alleen een bestaand dier van deze gebruiker mag regels krijgen. */
function petVanGebruiker(publicId: string, userId: number) {
  if (!publicId) return null;
  const pet = getPetByPublicId(publicId);
  if (!pet || pet.userId !== userId) return null;
  return pet;
}

function leesRegels(formData: FormData): Array<Required<{
  name: string;
  grams: number;
  calcium: number | null;
  fosfor: number | null;
  energie: number | null;
  eiwit: number | null;
  vet: number | null;
  bron: string;
  catalogId: number | null;
}>> {
  const raw = String(formData.get("regels") ?? "[]");
  let parsed: InkomendeRegel[] = [];
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) parsed = value as InkomendeRegel[];
  } catch {
    return [];
  }

  return parsed
    .map((regel) => ({
      name: String(regel.name ?? "").trim(),
      grams: numOrNull(regel.grams) ?? 0,
      calcium: numOrNull(regel.calcium),
      fosfor: numOrNull(regel.fosfor),
      energie: numOrNull(regel.energie),
      eiwit: numOrNull(regel.eiwit),
      vet: numOrNull(regel.vet),
      bron: String(regel.bron ?? "").slice(0, 40),
      catalogId: numOrNull(regel.catalogId),
    }))
    .filter((regel) => regel.name.length > 0 && regel.grams > 0 && regel.grams <= 5000)
    .slice(0, 40);
}

/** Bewaart de regels in het dieetdagboek van het gekozen dier. */
export async function saveVoercheckAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const publicId = String(formData.get("petId") ?? "");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get("day") ?? ""))
    ? String(formData.get("day"))
    : vandaag();

  if (!user) redirect("/inloggen?next=/?tab=voercheck");
  const pet = petVanGebruiker(publicId, user.id);
  if (!pet) redirect("/?tab=voercheck&fout=dier");

  const regels = leesRegels(formData);
  if (regels.length === 0) redirect("/?tab=voercheck&fout=leeg");

  for (const regel of regels) {
    addDietItem({
      petId: pet.id,
      userId: user.id,
      day,
      name: regel.name,
      grams: regel.grams,
      calcium: regel.calcium,
      fosfor: regel.fosfor,
      energie: regel.energie,
      eiwit: regel.eiwit,
      vet: regel.vet,
      bron: regel.bron,
      catalogId: regel.catalogId,
    });
  }

  revalidatePath("/");
  revalidatePath("/account");
  redirect(`/?tab=voercheck&dier=${pet.publicId}&opgeslagen=${regels.length}`);
}

/** Maakt een momentopname met een eigen, niet te raden link. */
export async function shareVoercheckAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const publicId = String(formData.get("petId") ?? "");
  const pet = user ? petVanGebruiker(publicId, user.id) : null;
  const ras = (String(formData.get("ras") ?? pet?.ras ?? "HOND") === "KAT" ? "KAT" : "HOND") as Dier;
  const pup = String(formData.get("pup") ?? "") === "1" || pet?.pup === true;
  const regels = leesRegels(formData);
  if (regels.length === 0) redirect("/?tab=voercheck&fout=leeg");

  const band = bandFor(ras, pup);
  const report = summariseMinerals(
    regels.map((regel) => ({
      grams: regel.grams,
      minerals: { calcium: regel.calcium, fosfor: regel.fosfor, energie: regel.energie },
    })),
    band,
  );

  const id = newSessionToken().slice(0, 22);
  saveDietReport({
    id,
    petName: pet?.name ?? String(formData.get("petName") ?? "").slice(0, 40),
    ras,
    pup,
    day: /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get("day") ?? ""))
      ? String(formData.get("day"))
      : vandaag(),
    items: regels,
    totals: report,
  });

  redirect(`/voercheck/r/${id}`);
}

/** Eén regel uit het dagboek halen. */
export async function deleteDietItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const petId = String(formData.get("petId") ?? "");
  if (Number.isFinite(id)) deleteDietItem(id, user.id);
  revalidatePath("/");
  redirect(`/?tab=voercheck${petId ? `&dier=${petId}` : ""}`);
}
