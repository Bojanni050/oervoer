"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { createOrderAction, type FormState } from "@/app/actions";
import { PACKAGE_LABELS, PORTIES } from "@/lib/globals";
import type { Dier, PackageKind, Portie } from "@/lib/types";

const KINDS: Array<{ value: PackageKind; description: string }> = [
  { value: "100", description: "Karkas, orgaan, spier, bot en vis" },
  { value: "PLUS", description: "Gemalen, pens en vis" },
  { value: "COMBI", description: "Half 100%, half Gemalen Plus" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary px-5" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      {pending ? "Opslaan…" : "Order aanmaken"}
    </button>
  );
}

const initialState: FormState = {};

export function OrderForm() {
  const [state, formAction] = useActionState(createOrderAction, initialState);
  const [ras, setRas] = useState<Dier>("HOND");
  const [kind, setKind] = useState<PackageKind>("100");
  const [portie, setPortie] = useState<Portie>("beide");
  const [weight, setWeight] = useState("12");
  const [packageKg, setPackageKg] = useState("10");

  const kg = Number(weight) || 0;
  const percent = Number(packageKg) || 0;
  const factor = ras === "KAT" ? 0.035 : 0.025;
  const daily = kg * factor * 1000;
  const meal = daily / 2;
  const days = kg > 0 ? Math.round(percent / (kg * factor)) : 0;

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
      <div className="surface p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span>Eigenaar</span>
            <input
              name="owner"
              required
              autoComplete="off"
              placeholder="Voor- en achternaam"
              className="input"
            />
          </label>
          <label className="field">
            <span>Naam dier</span>
            <input
              name="animal"
              required
              autoComplete="off"
              placeholder="Bijv. Ollie"
              className="input"
            />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="eyebrow mb-2">Soort dier</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["HOND", "KAT"] as Dier[]).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  ras === value
                    ? "border-moss bg-moss-soft text-moss"
                    : "border-line bg-white text-muted hover:border-moss/50"
                }`}
              >
                <input
                  type="radio"
                  name="ras"
                  value={value}
                  checked={ras === value}
                  onChange={() => setRas(value)}
                  className="sr-only"
                />
                {value === "HOND" ? "Hond" : "Kat"}
                <span className="mt-0.5 block text-xs font-normal opacity-70">
                  {value === "HOND" ? "25 g per kg per dag" : "35 g per kg per dag"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span>Gewicht dier (kg)</span>
            <input
              type="number"
              name="weight"
              required
              min="0.5"
              step="0.1"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className="input"
            />
          </label>
          <label className="field">
            <span>Pakketgrootte (kg)</span>
            <input
              type="number"
              name="packageKg"
              required
              min="1"
              step="0.5"
              value={packageKg}
              onChange={(event) => setPackageKg(event.target.value)}
              className="input"
            />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="eyebrow mb-2">Pakkettype</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors ${
                  kind === option.value
                    ? "border-moss bg-moss-soft"
                    : "border-line bg-white hover:border-moss/50"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={option.value}
                  checked={kind === option.value}
                  onChange={() => setKind(option.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold">
                  {PACKAGE_LABELS[option.value]}
                </span>
                <span className="mt-1 block text-[0.7rem] leading-snug text-muted">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span>Vermijden</span>
            <textarea
              name="donts"
              rows={2}
              placeholder="RUND, KIP, HARD BOT"
              className="input resize-none"
            />
            <span className="text-[0.7rem] text-muted">
              Gescheiden door komma&apos;s. Smaak, vleessoort of type.
            </span>
          </label>
          <label className="field">
            <span>Voorkeur</span>
            <textarea
              name="prefers"
              rows={2}
              placeholder="EEND, ZALM"
              className="input resize-none"
            />
            <span className="text-[0.7rem] text-muted">
              Deze smaken krijgen vier keer zoveel kans.
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span>Portiegrootte</span>
            <select
              name="portie"
              value={portie}
              onChange={(event) => setPortie(event.target.value as Portie)}
              className="input"
            >
              {PORTIES.map((option) => (
                <option key={option} value={option}>
                  {option === "beide"
                    ? "Maakt niet uit"
                    : option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notities (optioneel)</span>
            <input name="notes" placeholder="Bijv. graag extra vis" className="input" />
          </label>
        </div>

        <label className="mt-5 flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="pup"
            className="size-4 rounded border-line accent-[#2f4a35]"
          />
          Pup of kitten (jonger dan een jaar)
        </label>

        {state.error ? (
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-xs text-muted">De picklijst wordt nog niet automatisch gemaakt.</p>
          <SubmitButton />
        </div>
      </div>

      <aside className="space-y-5">
        <div className="surface bg-moss p-6 text-white">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/60">
            Verwachte maaltijd
          </p>
          <p className="num mt-3 font-display text-5xl leading-none">
            {Number.isFinite(meal) ? Math.round(meal) : 0}
            <span className="ml-1 text-base font-normal text-white/60">g</span>
          </p>
          <p className="mt-2 text-sm text-white/70">
            per maaltijd, {Math.round(daily)} g per dag
          </p>
          <dl className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-white/60">Pakket gaat mee</dt>
              <dd className="num font-semibold">{days > 0 ? `${days} dagen` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/60">Type</dt>
              <dd className="font-semibold">{PACKAGE_LABELS[kind]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/60">Portie</dt>
              <dd className="font-semibold">{portie === "beide" ? "Vrij" : portie}</dd>
            </div>
          </dl>
        </div>

        <div className="surface p-6 text-sm leading-relaxed text-muted">
          <p className="eyebrow mb-2">Goed om te weten</p>
          <p>
            De wizard vult het pakket met vis, pens (alleen hond), compleet karkas, orgaan,
            spiervlees en bot. Vermijdingen en voorkeuren gaan rechtstreeks de selectie in.
          </p>
          <p className="mt-3">
            Kies <strong className="text-ink">grote porties</strong> voor stukken vanaf 500 g en
            kleine porties voor stukken tot 250 g.
          </p>
        </div>
      </aside>
    </form>
  );
}
