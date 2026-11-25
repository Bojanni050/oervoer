/** Foto's worden als BLOB in SQLite bewaard, zodat back-ups en deploys één bestand zijn. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_PHOTO_SIDE = 720;

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type PhotoPayload = { data: Uint8Array; contentType: string };

export async function photoFromForm(
  formData: FormData,
  field = "photo",
): Promise<PhotoPayload | null> {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) return null;

  const contentType = value.type || "application/octet-stream";
  if (!(PHOTO_TYPES as readonly string[]).includes(contentType)) {
    throw new Error("Kies een JPG-, PNG- of WebP-afbeelding.");
  }
  if (value.size > MAX_PHOTO_BYTES) {
    throw new Error("De foto is groter dan 2 MB. Kies een kleinere afbeelding.");
  }

  return {
    data: new Uint8Array(await value.arrayBuffer()),
    contentType,
  };
}
