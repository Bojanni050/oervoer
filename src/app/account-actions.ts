"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createPet,
  createSession,
  createUser,
  deletePet,
  deleteSession,
  getUserByEmail,
  savePhoto,
  updatePet,
  updateUserProfile,
} from "@/lib/db";
import {
  clearSessionCookie,
  hashPassword,
  hashToken,
  newSessionToken,
  normalizeEmail,
  requireUser,
  safeNext,
  sessionExpiry,
  setSessionCookie,
  validEmail,
  verifyPassword,
} from "@/lib/auth";
import { photoFromForm } from "@/lib/photo";

export type AuthFormState = { error?: string };

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const next = safeNext(formData.get("next"));

  try {
    if (name.length < 2) throw new Error("Vul je naam in.");
    if (!validEmail(email)) throw new Error("Vul een geldig e-mailadres in.");
    if (password.length < 8) throw new Error("Kies een wachtwoord van minimaal 8 tekens.");
    if (password !== confirm) throw new Error("De wachtwoorden zijn niet gelijk.");

    const photo = await photoFromForm(formData);
    const photoId = photo ? savePhoto(photo) : null;
    const user = createUser({
      name,
      email,
      passwordHash: hashPassword(password),
      photoId,
    });

    const token = newSessionToken();
    createSession(user.id, hashToken(token), sessionExpiry());
    await setSessionCookie(token);
  } catch (error) {
    return { error: message(error, "Account aanmaken mislukt.") };
  }

  redirect(next);
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  try {
    const user = getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error("E-mailadres of wachtwoord klopt niet.");
    }
    const token = newSessionToken();
    createSession(user.id, hashToken(token), sessionExpiry());
    await setSessionCookie(token);
  } catch (error) {
    return { error: message(error, "Inloggen mislukt.") };
  }

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get("oervoer_sessie")?.value;
  if (token) deleteSession(hashToken(token));
  await clearSessionCookie();
  redirect("/");
}

export async function updateProfileAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireUser();

  try {
    const photo = await photoFromForm(formData);
    const photoId = photo ? savePhoto(photo) : null;
    updateUserProfile(user.id, {
      name: String(formData.get("name") ?? ""),
      photoId,
    });
  } catch (error) {
    return { error: message(error, "Profiel opslaan mislukt.") };
  }

  revalidatePath("/account");
  revalidatePath("/");
  redirect("/account?opgeslagen=profiel");
}

export async function savePetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireUser();
  const publicId = String(formData.get("petId") ?? "");
  const weight = Number.parseFloat(String(formData.get("weight") ?? "").replace(",", "."));

  try {
    const photo = await photoFromForm(formData);
    const photoId = photo ? savePhoto(photo) : null;
    const payload = {
      name: String(formData.get("name") ?? ""),
      ras: String(formData.get("ras") ?? "HOND"),
      weight,
      pup: formData.get("pup") === "on",
      portie: String(formData.get("portie") ?? "beide"),
      donts: formData.getAll("donts").map(String),
      photoId,
      notes: String(formData.get("notes") ?? ""),
    };

    if (publicId) updatePet(user.id, publicId, payload);
    else createPet(user.id, payload);
  } catch (error) {
    return { error: message(error, "Dier opslaan mislukt.") };
  }

  revalidatePath("/account");
  revalidatePath("/");
  redirect("/account?opgeslagen=dier");
}

export async function deletePetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const publicId = String(formData.get("petId") ?? "");
  if (publicId) deletePet(user.id, publicId);
  revalidatePath("/account");
  revalidatePath("/");
  redirect("/account");
}
