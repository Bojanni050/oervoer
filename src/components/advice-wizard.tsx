"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Cat, Check, Dog, Info, Sparkles } from "lucide-react";
import { createAdviceAction } from "@/app/actions";
import {
  ADVICE_STYLES,
  PACKAGE_SIZES,
  PROTEINS,
  STYLE_ORDER,
  adviceDaysLabel,
  buildAdvice,
  daysForPackage,
  formatAdviceGrams,
  mealsPerDayFor,
  recommendedPackageKg,
  type AdviceInput,
} from "@/lib/advice";
import type { Dier, PackageKind, Portie } from "@/lib/types";

const STEPS = ["Je dier", "Wensen", "Stijl"] as const;

export interface PetOption {
  publicId: string;
  name: string;
  ras: Dier;
  weight: number;
  pup: boolean;
  portie: Portie;
  donts: string[];
  photoId: string | null;
}

interface AdviceWizardProps {
  pets?: PetOption[];
  defaultPetId?: string;
  loggedIn?: boolean;
}

const PORTIE_OPTIONS: Array<{ value: Portie; label: string; description: string }> = [
  { value: "beide", label: "Maakt niet uit", description: "Kleine en grote stukken door elkaar." },
  { value: "kleine porties", label: "Kleine stukken", description: "Tot ongeveer 250 gram per stuk." },
  { value: "grote porties", label: "Grote stukken", description: "Vanaf ongeveer 500 gram per stuk." },
];

const LIKES = PROTEINS.filter(
  (protein) => protein.value !== "PENS" && protein.value !== "ORGAAN",
);

export function AdviceWizard({ pets = [], defaultPetId, loggedIn = false }: AdviceWizardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const initialPet = pets.find((pet) => pet.publicId === defaultPetId);

  const [selectedPet, setSelectedPet] = useState(initialPet?.publicId ?? "");
  const [animal, setAnimal] = useState(initialPet?.name ?? "");
  const [ras, setRas] = useState<Dier>(initialPet?.ras ?? "HOND");
  const [weight, setWeight] = useState(initialPet ? String(initialPet.weight).replace(".", ",") : "");
  const [pup, setPup] = useState(initialPet?.pup ?? false);
  const [donts, setDonts] = useState<string[]>(initialPet?.donts ?? []);
  const [likes, setLikes] = useState<string[]>([]);
  const [portie, setPortie] = useState<Portie>(initialPet?.portie ?? "beide");
  const [kind, setKind] = useState<PackageKind>("PLUS");
  const [packageKg, setPackageKg] = useState<number>(10);

  function choosePet(pet: PetOption) {
    setSelectedPet(pet.publicId);
    setAnimal(pet.name);
    setRas(pet.ras);
    setWeight(String(pet.weight).replace(".", ","));
    setPup(pet.pup);
    setDonts(pet.donts);
    setLikes([]);
    setPortie(pet.portie);
  }

  function clearPet() {
    setSelectedPet("");
    setAnimal("");
    setRas("HOND");
    setWeight("");
    setPup(false);
    setDonts([]);
    setLikes([]);
    setPortie("beide");
  }

  const weightNumber = Number.parseFloat(weight.replace(",", "."));
  const validWeight = Number.isFinite(weightNumber) && weightNumber >= 0.5 && weightNumber <= 90;
  const mealsPerDay = mealsPerDayFor(pup);

  const draft: AdviceInput = {
    animal,
    ras,
    weight: weightNumber,
    pup,
    portie,
    kind,
    packageKg,
    donts,
    likes,
  };

  let advice = null;
  if (validWeight) {
    try {
      advice = buildAdvice(draft);
    } catch {
      advice = null;
    }
  }

  const recommended = validWeight ? recommendedPackageKg(ras, weightNumber) : 10;

  function toggleDont(value: string) {
    setDonts((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  }

  function toggleLike(value: string) {
    setLikes((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  }

  function next() {
    setError("");
    if (step === 0 && !validWeight) {
      setError("Vul eerst het gewicht van je dier in (0,5 – 90 kg).");
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function submit() {
    if (!validWeight) {
      setError("Vul eerst het gewicht van je dier in (0,5 – 90 kg).");
      setStep(0);
      return;
    }
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await createAdviceAction(draft, selectedPet || undefined);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.id) router.push(`/advies/${result.id}`);
    });
  }

  function primaryAction() {
    if (step < STEPS.length - 1) next();
    else submit();
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="surface overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4 sm:px-6">
          {STEPS.map((label, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => index < step && setStep(index)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-moss text-white"
                    : done
                      ? "bg-moss-soft text-moss hover:bg-moss-soft/70"
                      : "text-muted"
                }`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full text-[0.65rem] ${
                    active ? "bg-white/15" : done ? "bg-moss text-white" : "bg-line/70 text-muted"
                  }`}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                {label}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-6 sm:px-7 sm:py-8">
          {step === 0 ? (
            <div className="space-y-6">
              <div>
                <p className="eyebrow mb-1">Stap 1</p>
                <h2 className="text-2xl">Over je dier</h2>
                <p className="mt-1 text-sm text-muted">
                  Naam mag, hoeft niet. Gewicht en soort zijn genoeg om te rekenen.
                </p>
              </div>

              {pets.length > 0 ? (
                <div>
                  <span className="mb-2 block text-sm font-medium">Kies een opgeslagen dier</span>
                  <div className="flex flex-wrap gap-2">
                    {pets.map((pet) => {
                      const active = selectedPet === pet.publicId;
                      return (
                        <button
                          key={pet.publicId}
                          type="button"
                          onClick={() => choosePet(pet)}
                          aria-pressed={active}
                          className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors ${
                            active
                              ? "border-moss bg-moss-soft/70 text-ink"
                              : "border-line bg-paper text-muted hover:border-moss/40"
                          }`}
                        >
                          <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-bone text-muted">
                            {pet.photoId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/foto/${pet.photoId}`}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : pet.ras === "KAT" ? (
                              <Cat className="size-3.5" strokeWidth={1.8} />
                            ) : (
                              <Dog className="size-3.5" strokeWidth={1.8} />
                            )}
                          </span>
                          {pet.name}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={clearPet}
                      aria-pressed={!selectedPet}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        !selectedPet
                          ? "border-moss bg-moss-soft/70 text-ink"
                          : "border-line bg-paper text-muted hover:border-moss/40"
                      }`}
                    >
                      Nieuw dier
                    </button>
                  </div>
                </div>
              ) : null}

              <label className="field">
                <span>Naam van je dier</span>
                <input
                  className="input"
                  value={animal}
                  onChange={(event) => setAnimal(event.target.value)}
                  placeholder="Bijv. Ollie"
                  autoComplete="off"
                  maxLength={40}
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-medium">Hond of kat?</span>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: "HOND" as const, label: "Hond", Icon: Dog },
                      { value: "KAT" as const, label: "Kat", Icon: Cat },
                    ] satisfies Array<{ value: Dier; label: string; Icon: typeof Dog }>
                  ).map(({ value, label, Icon }) => {
                    const active = ras === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRas(value)}
                        aria-pressed={active}
                        className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                          active
                            ? "border-moss bg-moss-soft/60"
                            : "border-line bg-paper hover:border-moss/40"
                        }`}
                      >
                        <span
                          className={`grid size-10 place-items-center rounded-full ${
                            active ? "bg-moss text-white" : "bg-bone text-muted"
                          }`}
                        >
                          <Icon className="size-5" strokeWidth={1.8} />
                        </span>
                        <span>
                          <span className="block font-medium">{label}</span>
                          <span className="block text-xs text-muted">
                            {value === "HOND" ? "25 g per kg" : "35 g per kg"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="field">
                <span>Gewicht</span>
                <div className="relative">
                  <input
                    className="input pr-12"
                    inputMode="decimal"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    placeholder="Bijv. 14,5"
                    aria-describedby="weight-help"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">
                    kg
                  </span>
                </div>
                <span id="weight-help" className="text-xs text-muted">
                  {validWeight
                    ? `Goed voor ongeveer ${formatAdviceGrams(weightNumber * (ras === "KAT" ? 35 : 25))} per dag.`
                    : "Tussen 0,5 en 90 kg."}
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-line bg-bone/50 p-4">
                <input
                  type="checkbox"
                  checked={pup}
                  onChange={(event) => setPup(event.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--color-moss)]"
                />
                <span>
                  <span className="block text-sm font-medium">Puppy of kitten</span>
                  <span className="block text-xs text-muted">
                    Dan rekenen we met drie maaltijden per dag in plaats van twee.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-7">
              <div>
                <p className="eyebrow mb-1">Stap 2</p>
                <h2 className="text-2xl">Wat past bij je dier?</h2>
                <p className="mt-1 text-sm text-muted">
                  Geef aan waar je dier dol op is, wat het liever niet eet en hoe groot de stukken
                  mogen zijn.
                </p>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium">Waar is je dier dol op?</span>
                <div className="flex flex-wrap gap-2">
                  {LIKES.map((protein) => {
                    const active = likes.includes(protein.value);
                    return (
                      <button
                        key={protein.value}
                        type="button"
                        onClick={() => toggleLike(protein.value)}
                        aria-pressed={active}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-moss bg-moss-soft text-moss"
                            : "border-line bg-paper text-muted hover:border-moss/40 hover:text-ink"
                        }`}
                      >
                        {protein.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Optioneel. Met deze smaken maken we straks een boodschappenlijst met concrete
                  producten.
                </p>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium">Liever niet</span>
                <div className="flex flex-wrap gap-2">
                  {PROTEINS.map((protein) => {
                    const active = donts.includes(protein.value);
                    return (
                      <button
                        key={protein.value}
                        type="button"
                        onClick={() => toggleDont(protein.value)}
                        aria-pressed={active}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-rust bg-rust-soft text-rust"
                            : "border-line bg-paper text-muted hover:border-rust/40 hover:text-ink"
                        }`}
                      >
                        {active ? "Geen " : ""}
                        {protein.label.toLowerCase()}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Laat leeg als je dier alles eet. Je kunt meerdere dingen kiezen.
                </p>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium">Voorkeur voor stukken</span>
                <div className="space-y-2">
                  {PORTIE_OPTIONS.map((option) => {
                    const active = portie === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPortie(option.value)}
                        aria-pressed={active}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                          active ? "border-moss bg-moss-soft/50" : "border-line bg-paper"
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                            active ? "border-moss bg-moss text-white" : "border-line"
                          }`}
                        >
                          {active ? <Check className="size-3" strokeWidth={3} /> : null}
                        </span>
                        <span>
                          <span className="block text-sm font-medium">{option.label}</span>
                          <span className="block text-xs text-muted">{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="flex gap-2 rounded-2xl bg-bone/70 p-3.5 text-xs leading-relaxed text-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-moss" strokeWidth={1.8} />
                Pens zit alleen in het menu voor honden. Katten krijgen standaard een menu zonder
                pens.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-7">
              <div>
                <p className="eyebrow mb-1">Stap 3</p>
                <h2 className="text-2xl">Kies je stijl</h2>
                <p className="mt-1 text-sm text-muted">
                  Elk menu heeft dezelfde voedingswaarde, maar een andere opbouw.
                </p>
              </div>

              <div className="space-y-2.5">
                {STYLE_ORDER.map((value) => {
                  const style = ADVICE_STYLES[value];
                  const active = kind === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setKind(value)}
                      aria-pressed={active}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                        active ? "border-moss bg-moss-soft/50" : "border-line bg-paper hover:border-moss/40"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                          active ? "border-moss bg-moss text-white" : "border-line"
                        }`}
                      >
                        {active ? <Check className="size-3" strokeWidth={3} /> : null}
                      </span>
                      <span>
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-display text-lg">{style.label}</span>
                          <span className="text-xs uppercase tracking-[0.12em] text-moss">
                            {style.tagline}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">
                          {style.description}
                        </span>
                        <span className="mt-1.5 block text-xs text-muted">
                          <strong className="font-medium text-ink">Past bij:</strong> {style.bestFor}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium">Pakketgrootte</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PACKAGE_SIZES.map((size) => {
                    const active = packageKg === size;
                    const days = validWeight
                      ? daysForPackage(ras, weightNumber, size)
                      : 0;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setPackageKg(size)}
                        aria-pressed={active}
                        className={`relative rounded-xl border px-3 py-3 text-center transition-colors ${
                          active ? "border-moss bg-moss text-white" : "border-line bg-paper"
                        }`}
                      >
                        {size === recommended ? (
                          <span
                            className={`absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide ${
                              active ? "bg-white text-moss" : "bg-ochre-soft text-ochre"
                            }`}
                          >
                            Ons advies
                          </span>
                        ) : null}
                        <span className="block font-display text-xl leading-none">{size} kg</span>
                        <span
                          className={`mt-1 block text-[0.68rem] ${
                            active ? "text-white/75" : "text-muted"
                          }`}
                        >
                          {adviceDaysLabel(days)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? (
                <p className="rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
                  {error}
                </p>
              ) : null}

              {!loggedIn ? (
                <p className="text-xs leading-relaxed text-muted">
                  <Link
                    href={`/inloggen?next=${encodeURIComponent("/#advies")}`}
                    className="font-medium text-moss hover:underline"
                  >
                    Log in
                  </Link>{" "}
                  of maak een account om dit advies te bewaren en je dieren terug te vinden.
                </p>
              ) : pets.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted">
                  <Link href="/account/dieren/nieuw" className="font-medium text-moss hover:underline">
                    Sla je dier op
                  </Link>{" "}
                  in je account. Dan staat het volgende keer al klaar.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-bone/40 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0}
            className="btn btn-ghost disabled:invisible"
          >
            <ArrowLeft className="size-4" strokeWidth={1.9} />
            Terug
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={primaryAction} className="btn btn-primary">
              Verder
              <ArrowRight className="size-4" strokeWidth={1.9} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending || !validWeight}
              className="btn btn-primary disabled:opacity-60"
            >
              {pending ? "Bezig…" : "Bekijk advies"}
              <Sparkles className="size-4" strokeWidth={1.9} />
            </button>
          )}
        </div>
      </div>

      <aside className="surface bg-moss p-5 text-white lg:sticky lg:top-24" aria-live="polite">
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-white/60">
          Jouw advies
        </p>

        {advice ? (
          <>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="font-display text-5xl leading-none">
                {advice.dailyGrams.toLocaleString("nl-NL")}
              </span>
              <span className="text-sm text-white/70">gram per dag</span>
            </p>

            <dl className="mt-5 space-y-2.5 border-t border-white/15 pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-white/65">Per maaltijd</dt>
                <dd className="font-medium">
                  {advice.mealGrams} g × {mealsPerDay}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/65">Pakket</dt>
                <dd className="font-medium">
                  {packageKg} kg · {ADVICE_STYLES[kind].label.toLowerCase()}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/65">Gaat mee</dt>
                <dd className="font-medium">{adviceDaysLabel(advice.days)}</dd>
              </div>
            </dl>

            {advice.notes.length > 0 ? (
              <p className="mt-4 rounded-xl bg-white/10 px-3 py-2.5 text-xs leading-relaxed text-white/80">
                {advice.notes[0]}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Vul het gewicht van je dier in. Dan zie je hier meteen hoeveel voer er per dag nodig
            is.
          </p>
        )}

        <div className="mt-6 border-t border-white/15 pt-4">
          <p className="text-xs leading-relaxed text-white/60">
            {ADVICE_STYLES[kind].tagline}. {ADVICE_STYLES[kind].bestFor}
          </p>
          {error && step !== 2 ? (
            <p className="mt-3 rounded-lg bg-rust px-3 py-2 text-xs text-white">{error}</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
