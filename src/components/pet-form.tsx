"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Cat, Dog } from "lucide-react";
import { savePetAction } from "@/app/account-actions";
import { PhotoField } from "@/components/photo-field";
import { PROTEINS } from "@/lib/advice";
import type { Dier, PetRecord, Portie } from "@/lib/types";

const PORTIE_OPTIONS: Array<{ value: Portie; label: string }> = [
  { value: "beide", label: "Maakt niet uit" },
  { value: "kleine porties", label: "Kleine stukken (tot 250 g)" },
  { value: "grote porties", label: "Grote stukken (vanaf 500 g)" },
];

export function PetForm({ pet }: { pet?: PetRecord }) {
  const [state, action, pending] = useActionState(savePetAction, {});
  const ras: Dier = pet?.ras ?? "HOND";

  return (
    <form action={action} className="surface space-y-6 p-6 sm:p-7">
      {pet ? <input type="hidden" name="petId" value={pet.publicId} /> : null}

      <PhotoField
        label="Foto van je dier (optioneel)"
        currentSrc={pet?.photoId ? `/foto/${pet.photoId}` : null}
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="field">
          <span>Naam</span>
          <input
            className="input"
            name="name"
            defaultValue={pet?.name ?? ""}
            required
            maxLength={40}
            placeholder="Bijv. Ollie"
          />
        </label>
        <label className="field">
          <span>Gewicht</span>
          <div className="relative">
            <input
              className="input pr-10"
              name="weight"
              inputMode="decimal"
              defaultValue={pet ? String(pet.weight).replace(".", ",") : ""}
              required
              placeholder="14,5"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">
              kg
            </span>
          </div>
        </label>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Hond of kat?</span>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "HOND" as const, label: "Hond", Icon: Dog },
              { value: "KAT" as const, label: "Kat", Icon: Cat },
            ] satisfies Array<{ value: Dier; label: string; Icon: typeof Dog }>
          ).map(({ value, label, Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper p-4 transition-colors has-[:checked]:border-moss has-[:checked]:bg-moss-soft/60"
            >
              <input
                type="radio"
                name="ras"
                value={value}
                defaultChecked={ras === value}
                className="sr-only"
              />
              <span className="grid size-10 place-items-center rounded-full bg-bone text-muted">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted">
                  {value === "HOND" ? "25 g per kg" : "35 g per kg"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Wat eet je dier liever niet?</span>
        <div className="flex flex-wrap gap-2">
          {PROTEINS.map((protein) => (
            <label
              key={protein.value}
              className="cursor-pointer rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm text-muted transition-colors has-[:checked]:border-rust has-[:checked]:bg-rust-soft has-[:checked]:text-rust"
            >
              <input
                type="checkbox"
                name="donts"
                value={protein.value}
                defaultChecked={pet?.donts.includes(protein.value)}
                className="sr-only"
              />
              {protein.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Laat leeg als je dier alles eet.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>Voorkeur voor stukken</span>
          <select className="input" name="portie" defaultValue={pet?.portie ?? "beide"}>
            {PORTIE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-3 self-end rounded-2xl border border-line bg-bone/50 p-4">
          <input
            type="checkbox"
            name="pup"
            defaultChecked={pet?.pup}
            className="mt-0.5 size-4 accent-[var(--color-moss)]"
          />
          <span>
            <span className="block text-sm font-medium">Puppy of kitten</span>
            <span className="block text-xs text-muted">Rekent met drie maaltijden per dag.</span>
          </span>
        </label>
      </div>

      <label className="field">
        <span>Notities (optioneel)</span>
        <textarea
          className="input min-h-20"
          name="notes"
          defaultValue={pet?.notes ?? ""}
          maxLength={500}
          placeholder="Bijv. gevoelige maag, houdt van grote stukken…"
        />
      </label>

      {state.error ? (
        <p className="rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Bezig…" : pet ? "Wijzigingen opslaan" : "Dier opslaan"}
        </button>
        <Link href="/account" className="btn btn-ghost">
          Annuleren
        </Link>
      </div>
    </form>
  );
}
