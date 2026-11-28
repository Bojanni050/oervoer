import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, Check, Heart, Scale, UtensilsCrossed } from "lucide-react";
import { AdviceWizard, type PetOption } from "@/components/advice-wizard";
import { VoercheckPanel, type VoercheckPet } from "@/components/voercheck-panel";
import { deleteDietItemAction } from "@/app/voercheck-actions";
import { ADVICE_STYLES, STYLE_ORDER } from "@/lib/advice";
import { getCurrentUser } from "@/lib/auth";
import { listDietDays, listDietItems, listPets } from "@/lib/db";
import { formatMineral } from "@/lib/minerals";
import type { PackageKind } from "@/lib/types";

export const metadata: Metadata = {
  title: "Voedingsadvies op maat",
  description:
    "Bereken hoeveel rauw voer je hond of kat per dag nodig heeft en kies een menu dat past bij wat je dier lekker vindt.",
};

const STEPS = [
  {
    title: "Vertel over je dier",
    text: "Soort, gewicht en of het om een pup of kitten gaat. Meer hebben we niet nodig om te rekenen.",
  },
  {
    title: "Geef je wensen door",
    text: "Wat je dier liever niet eet en of het kleine of grote stukken prettig vindt.",
  },
  {
    title: "Kies een stijl",
    text: "Meer gemalen, meer karkas of van beide wat. Je ziet meteen hoeveel gram per dag, hoe lang een pakket meegaat en welke producten je in huis haalt.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ dier?: string; tab?: string; opgeslagen?: string; fout?: string }>;
}) {
  const user = await getCurrentUser();
  const { dier, tab, opgeslagen, fout } = await searchParams;
  const voercheck = tab === "voercheck";
  const vandaag = new Date().toISOString().slice(0, 10);
  const petRecords = user ? listPets(user.id) : [];
  const pets: PetOption[] = user
    ? listPets(user.id).map((pet) => ({
        publicId: pet.publicId,
        name: pet.name,
        ras: pet.ras,
        weight: pet.weight,
        pup: pet.pup,
        portie: pet.portie,
        donts: pet.donts,
        photoId: pet.photoId,
      }))
    : [];
  const defaultPetId = pets.some((pet) => pet.publicId === dier) ? dier : undefined;
  const gekozenDier = petRecords.find((pet) => pet.publicId === (dier ?? defaultPetId)) ?? petRecords[0];
  const voercheckPets: VoercheckPet[] = petRecords.map((pet) => ({
    publicId: pet.publicId,
    name: pet.name,
    ras: pet.ras,
    pup: pet.pup,
  }));
  const dagboek = voercheck && gekozenDier
    ? { dagen: listDietDays(gekozenDier.id, 14), vandaag: listDietItems(gekozenDier.id, vandaag) }
    : null;

  return (
    <div className="space-y-14 sm:space-y-20">
      <section className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p className="eyebrow mb-3">Rauw voer, op maat</p>
          <h1 className="max-w-2xl text-[2.6rem] leading-[1.02] tracking-tight sm:text-[3.4rem]">
            Wat heeft jouw hond of kat{" "}
            <em className="font-display italic text-moss">echt</em> nodig?
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            In drie stappen bereken je het dagrantsoen, kies je een menu dat past bij je dier en zie
            je welke producten je nodig hebt.
          </p>
          <a href="#advies" className="btn btn-primary mt-6">
            Start het advies
            <ArrowDown className="size-4" strokeWidth={1.9} />
          </a>
        </div>

        <ul className="grid gap-2 text-sm text-muted">
          {[
            { Icon: Scale, text: "Gerekend op gewicht en soort" },
            { Icon: Heart, text: "Rekening met wat je dier niet eet" },
            { Icon: UtensilsCrossed, text: "Jij kiest de opbouw van het menu" },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 rounded-full bg-paper/70 px-3.5 py-2">
              <Icon className="size-4 text-moss" strokeWidth={1.8} />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section id="advies" className="scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Link href="#advies" className={voercheck ? "btn btn-ghost" : "btn btn-primary"}>
            Advies op maat
          </Link>
          <Link href="/?tab=voercheck#advies" className={voercheck ? "btn btn-primary" : "btn btn-ghost"}>
            Voercheck
          </Link>
          <span className="ml-1 text-xs text-muted">
            {voercheck ? "Tel op wat je nu voert" : "Bereken wat je dier nodig heeft"}
          </span>
        </div>

        {opgeslagen ? (
          <p className="mb-4 rounded-xl border border-line bg-moss-soft/60 px-4 py-3 text-sm">
            {opgeslagen} regel(s) bewaard in het dieetdagboek.
          </p>
        ) : null}
        {fout === "leeg" ? (
          <p className="mb-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm">
            Voeg eerst een product met grammen toe.
          </p>
        ) : null}
        {fout === "dier" ? (
          <p className="mb-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm">
            Kies eerst een dier van je account.
          </p>
        ) : null}

        {voercheck ? (
          <div className="space-y-8">
            <VoercheckPanel
              pets={voercheckPets}
              defaultPetId={gekozenDier?.publicId}
              loggedIn={Boolean(user)}
              vandaag={vandaag}
            />
            {dagboek && gekozenDier ? (
              <div className="surface p-5 sm:p-7">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow mb-1">Dieetdagboek</p>
                    <h2 className="text-xl">{gekozenDier.name}</h2>
                  </div>
                  <p className="text-xs text-muted">
                    {gekozenDier.ras === "KAT" ? "kat" : "hond"} · {gekozenDier.weight} kg
                    {gekozenDier.pup ? " · pup" : ""}
                  </p>
                </div>

                {dagboek.dagen.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nog geen dagen bewaard. Vul hierboven in wat je voert en kies &quot;Bewaar in
                    dagboek&quot;.
                  </p>
                ) : (
                  <table className="table w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left">Dag</th>
                        <th className="text-right">Regels</th>
                        <th className="text-right">Gram</th>
                        <th className="text-right">Ca (g)</th>
                        <th className="text-right">P (g)</th>
                        <th className="text-right">kcal</th>
                        <th className="text-right">Ca per 100 g</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dagboek.dagen.map((dag) => (
                        <tr key={dag.day}>
                          <td className="font-medium">{dag.day}</td>
                          <td className="num text-right">{dag.items}</td>
                          <td className="num text-right">{Math.round(dag.grams)}</td>
                          <td className="num text-right">{dag.calcium.toFixed(2)}</td>
                          <td className="num text-right">{dag.fosfor.toFixed(2)}</td>
                          <td className="num text-right">{Math.round(dag.energie)}</td>
                          <td className="num text-right">
                            {dag.grams > 0
                              ? `${formatMineral((dag.calcium / dag.grams) * 100)} g`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {dagboek.vandaag.length > 0 ? (
                  <div className="mt-6">
                    <p className="eyebrow mb-2">Vandaag</p>
                    <ul className="divide-y divide-line text-sm">
                      {dagboek.vandaag.map((regel) => (
                        <li key={regel.id} className="flex items-center justify-between gap-3 py-2">
                          <span>
                            {regel.name}
                            <span className="ml-2 text-xs text-muted">
                              {regel.grams} g
                              {regel.bron ? ` · ${regel.bron}` : ""}
                            </span>
                          </span>
                          <form action={deleteDietItemAction}>
                            <input type="hidden" name="id" value={regel.id} />
                            <input type="hidden" name="petId" value={gekozenDier.publicId} />
                            <button type="submit" className="btn btn-ghost px-2 py-1 text-xs">
                              Verwijderen
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <AdviceWizard pets={pets} defaultPetId={defaultPetId} loggedIn={Boolean(user)} />
        )}
      </section>

      <section id="hoe-het-werkt" className="scroll-mt-24">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Hoe het werkt</p>
            <h2 className="text-3xl">Van gegevens naar een menu</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            De berekening is dezelfde als die onze slagerij gebruikt voor picklijsten. Alleen
            zonder productnamen: eerst de hoeveelheid, dan de verhouding.
          </p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="surface p-5">
              <span className="grid size-8 place-items-center rounded-full bg-moss-soft font-display text-sm text-moss">
                {index + 1}
              </span>
              <h3 className="mt-3 text-lg">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-6 max-w-2xl">
          <p className="eyebrow mb-1">De drie stijlen</p>
          <h2 className="text-3xl">Zelfde voeding, andere opbouw</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            De pakketten van OerVoer heten intern anders dan je op de site ziet. We hebben ze
            vertaald naar wat ze voor je dier betekenen.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {STYLE_ORDER.map((kind) => {
            const style = ADVICE_STYLES[kind];
            return (
              <article key={kind} className="surface flex flex-col p-5">
                <p className="eyebrow text-moss">{style.tagline}</p>
                <h3 className="mt-1 text-2xl">{style.label}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {style.description}
                </p>
                <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs text-muted">
                  {componentsFor(kind).map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-moss" strokeWidth={2.4} />
                      {line}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface bg-paper/80 p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="eyebrow mb-1">Even eerlijk</p>
          <h2 className="text-2xl">Een berekening, geen wondermiddel</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Het advies gaat uit van een gezond, volwassen dier met een normaal activiteitsniveau.
            Puppy&apos;s, kittens, drachtige dieren en dieren met een aandoening hebben soms meer of
            minder nodig. Gebruik de uitkomst als startpunt en kijk hoe je dier reageert. Twijfel
            je? Overleg met je dierenarts.
          </p>
        </div>
      </section>
    </div>
  );
}

function componentsFor(kind: PackageKind): string[] {
  if (kind === "PLUS") {
    return [
      "Gemalen vlees als basis",
      "15% vis voor de onverzadigde vetten",
      "15% pens voor honden, tenzij je dat uitsluit",
    ];
  }
  if (kind === "100") {
    return [
      "Ongeveer de helft karkas, met bot en kraakbeen",
      "Spiervlees, orgaan en een kleiner deel vis",
      "Voor katten de zachtere karkasvariant",
    ];
  }
  return [
    "De helft meer gemalen, de helft meer karkas",
    "Zacht én stevig in één pakket",
    "Fijn als je dier moet wennen aan karkas",
  ];
}
