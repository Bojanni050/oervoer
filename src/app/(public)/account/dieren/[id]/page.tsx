import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PetForm } from "@/components/pet-form";
import { requireUser } from "@/lib/auth";
import { getPetByPublicId } from "@/lib/db";

export const metadata: Metadata = { title: "Dier bewerken" };

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/account/dieren/${id}`);
  const pet = getPetByPublicId(id);
  if (!pet || pet.userId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/account" className="text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="mr-1 inline size-3.5" strokeWidth={1.9} />
          Terug naar mijn account
        </Link>
        <p className="eyebrow mb-1 mt-4">Mijn dieren</p>
        <h1 className="text-4xl leading-tight">{pet.name}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Pas de gegevens aan die de wizard voortaan moet gebruiken.
        </p>
      </div>

      <PetForm pet={pet} />
    </div>
  );
}
