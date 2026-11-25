"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { MAX_PHOTO_BYTES, MAX_PHOTO_SIDE } from "@/lib/photo";

interface PhotoFieldProps {
  name?: string;
  label: string;
  currentSrc?: string | null;
  hint?: string;
}

/**
 * Verkleint foto's in de browser voordat ze worden verstuurd. Zo blijven
 * uploads klein en past een telefoonfoto altijd binnen de limiet.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function PhotoField({
  name = "photo",
  label,
  currentSrc,
  hint = "JPG, PNG of WebP. Wordt automatisch verkleind.",
}: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState("");

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setProblem("");
    const resized = await shrink(file);
    if (resized.size > MAX_PHOTO_BYTES) {
      setProblem("Deze foto is te groot. Kies een kleinere afbeelding.");
      input.value = "";
      return;
    }

    if (resized !== file) {
      const transfer = new DataTransfer();
      transfer.items.add(resized);
      input.files = transfer.files;
    }
    setPreview(URL.createObjectURL(resized));
  }

  const shown = preview ?? currentSrc ?? null;

  return (
    <div className="field">
      <span>{label}</span>
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-bone">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <Camera className="size-5 text-muted" strokeWidth={1.7} />
          )}
        </span>
        <div className="min-w-0">
          <input
            ref={inputRef}
            type="file"
            name={name}
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleChange}
            className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-bone file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-moss-soft"
          />
          <p className="mt-1 text-xs text-muted">{hint}</p>
          {problem ? <p className="mt-1 text-xs text-rust">{problem}</p> : null}
        </div>
      </div>
    </div>
  );
}
