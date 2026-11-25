import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PetForm } from "@/components/pet-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nieuw dier" };

export default async function NewPetPage() {
  await requireUser("/account/dieren/nieuw");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/account" className="text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="mr-1 inline size-3.5" strokeWidth={1.9} />
          Terug naar mijn account
        </Link>
        <p className="eyebrow mb-1 mt-4">Mijn dieren</p>
        <h1 className="text-4xl leading-tight">Een nieuw dier</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Deze gegevens worden voortaan als startpunt gebruikt voor het voedingsadvies.
        </p>
      </div>

      <PetForm />
    </div>
  );
}
