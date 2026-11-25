import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Info, Printer as PrinterIcon, ShoppingBasket } from "lucide-react";
import { PrintButton } from "@/components/order-actions";
import { getAdvice } from "@/lib/db";
import {
  ADVICE_STYLES,
  formatAdviceGrams,
  portieLabel,
  styleLabel,
} from "@/lib/advice";
import { formatDate } from "@/lib/format";
import {
  formatShopPrice,
  formatShopWeight,
  shoppingListFor,
  storeSummary,
} from "@/lib/shopping";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const advice = getAdvice(id);
  if (!advice) return { title: "Advies niet gevonden" };
  const name = advice.animal || (advice.ras === "KAT" ? "je kat" : "je hond");
  return { title: `Voedingsadvies voor ${name}` };
}

const COLORS: Record<string, string> = {
  vis: "#3f6f83",
  pens: "#7d4a3a",
  karkas: "#2f4a35",
  orgaan: "#a0432b",
  spier: "#b5843c",
  bot: "#8a826f",
  gemalen: "#5f7a52",
};

const TRANSITION = [
  { week: "Week 1", newFood: 25, oldFood: 75 },
  { week: "Week 2", newFood: 50, oldFood: 50 },
  { week: "Week 3", newFood: 75, oldFood: 25 },
  { week: "Week 4", newFood: 100, oldFood: 0 },
];

export default async function AdvicePage({ params }: PageProps) {
  const { id } = await params;
  const advice = getAdvice(id);
  if (!advice) notFound();

  const { result } = advice;
  const name = advice.animal || (advice.ras === "KAT" ? "je kat" : "je hond");
  const style = ADVICE_STYLES[advice.kind];
  const isCat = advice.ras === "KAT";
  const shopping = shoppingListFor(advice, result.composition);
  const stores = storeSummary(shopping);

  return (
    <div className="print-shell mx-auto max-w-3xl">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="btn btn-ghost">
          <ArrowLeft className="size-4" strokeWidth={1.9} />
          Nieuw advies
        </Link>
        <PrintButton />
      </div>

      <article className="surface overflow-hidden">
        <header className="border-b border-line bg-bone/50 px-6 py-7 sm:px-9">
          <p className="eyebrow mb-2">Voedingsadvies · {formatDate(advice.createdAt)}</p>
          <h1 className="text-[2.1rem] leading-tight sm:text-[2.55rem]">
            {advice.animal ? `Voor ${advice.animal}` : "Jouw voedingsadvies"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isCat ? "Kat" : "Hond"} · {advice.weight.toLocaleString("nl-NL")} kg ·{" "}
            {advice.pup ? "pup of kitten" : "volwassen"} · {style.label.toLowerCase()}
          </p>
        </header>

        <div className="grid border-b border-line sm:grid-cols-3">
          <div className="px-6 py-5 sm:px-7">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
              Per dag
            </p>
            <p className="mt-1 font-display text-3xl">
              {result.dailyGrams.toLocaleString("nl-NL")}
              <span className="ml-1 text-sm font-sans text-muted">g</span>
            </p>
          </div>
          <div className="border-t border-line px-6 py-5 sm:border-l sm:border-t-0 sm:px-7">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
              Per maaltijd
            </p>
            <p className="mt-1 font-display text-3xl">
              {result.mealGrams.toLocaleString("nl-NL")}
              <span className="ml-1 text-sm font-sans text-muted">
                g × {result.mealsPerDay}
              </span>
            </p>
          </div>
          <div className="border-t border-line px-6 py-5 sm:border-l sm:border-t-0 sm:px-7">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
              {advice.packageKg} kg gaat mee
            </p>
            <p className="mt-1 font-display text-3xl">
              {result.days}
              <span className="ml-1 text-sm font-sans text-muted">
                {result.days === 1 ? "dag" : "dagen"}
              </span>
            </p>
          </div>
        </div>

        <section className="border-b border-line px-6 py-7 sm:px-9">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow mb-1">Samenstelling</p>
              <h2 className="text-2xl">Zo is het {advice.packageKg} kg-pakket opgebouwd</h2>
            </div>
            <p className="text-xs text-muted">
              {isCat ? "Kattenvariant" : "Hondenvariant"} · {styleLabel(advice.kind)}
            </p>
          </div>

          <div
            className="mt-5 flex h-4 overflow-hidden rounded-full bg-bone"
            role="img"
            aria-label={`Samenstelling: ${result.composition
              .map((part) => `${part.label} ${part.percent}%`)
              .join(", ")}`}
          >
            {result.composition.map((part) => (
              <span
                key={part.key}
                style={{
                  width: `${part.percent}%`,
                  backgroundColor: COLORS[part.key] ?? "#8a826f",
                }}
                title={`${part.label}: ${part.percent}%`}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {result.composition.map((part) => (
              <div
                key={part.key}
                className="flex items-center justify-between gap-3 border-b border-line/60 py-1.5 text-sm last:border-0"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[part.key] ?? "#8a826f" }}
                  />
                  {part.label}
                </span>
                <span className="num text-muted">
                  <span className="font-medium text-ink">{part.percent}%</span> ·{" "}
                  {formatAdviceGrams(part.grams)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 flex gap-2 rounded-xl bg-bone/70 p-3.5 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-moss" strokeWidth={1.8} />
            {style.description} {style.bestFor}
          </p>
        </section>

        <section className="border-b border-line px-6 py-7 sm:px-9">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow mb-1">Boodschappenlijst</p>
              <h2 className="text-2xl">Dit heb je nodig</h2>
            </div>
            {stores.length > 0 ? (
              <p className="text-xs text-muted">
                Te koop bij {stores.map((store) => store.toLowerCase()).join(", ")}
              </p>
            ) : null}
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            De hoeveelheden zijn afgeleid van de samenstelling van je pakket en gelden voor één
            pakket. Koop ze per stuk of per kilo, net wat handig is.
          </p>

          <div className="mt-4 divide-y divide-line/70 border-y border-line/70">
            {shopping.map((line) => (
              <div key={line.key} className="grid gap-2 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <div>
                  <p className="text-sm font-medium">{line.label}</p>
                  <p className="num text-xs text-muted">{formatAdviceGrams(line.grams)}</p>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {line.products.map((product) => (
                    <li
                      key={`${line.key}-${product.name}`}
                      className="flex items-start gap-2 rounded-xl bg-bone/70 px-3 py-2 text-xs"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 size-3 shrink-0 rounded-[2px] border border-line bg-paper"
                      />
                      <span className="min-w-0">
                        {product.url ? (
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium underline decoration-line underline-offset-2 hover:text-moss hover:decoration-moss"
                          >
                            {product.name}
                            <ExternalLink
                              aria-hidden="true"
                              className="no-print ml-1 inline size-3 align-[-1px]"
                              strokeWidth={1.9}
                            />
                          </a>
                        ) : (
                          <span className="font-medium">{product.name}</span>
                        )}
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.68rem] text-muted">
                          {product.weightG ? (
                            <span className="num">{formatShopWeight(product.weightG)}</span>
                          ) : null}
                          {product.priceCents ? (
                            <span className="num">{formatShopPrice(product.priceCents)}</span>
                          ) : null}
                          <span className="uppercase tracking-[0.1em]">{product.store}</span>
                          {product.note ? <span className="text-moss">{product.note}</span> : null}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted">
            <ShoppingBasket className="mt-0.5 size-4 shrink-0 text-moss" strokeWidth={1.8} />
            De producten, gewichten en prijzen komen van darf.nl en kunnen afwijken. Een
            DARF-product is een voorbeeld van de juiste soort en smaak; de grammen hierboven
            blijven leidend. Let bij bot op dat het niet te klein gesneden is.
          </p>
        </section>

        <section className="grid gap-6 border-b border-line px-6 py-7 sm:grid-cols-2 sm:px-9">
          <div>
            <p className="eyebrow mb-1">Jouw wensen</p>
            <h2 className="text-xl">Waar we rekening mee hielden</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3 border-b border-line/60 pb-2">
                <dt className="text-muted">Stukken</dt>
                <dd className="text-right font-medium">{portieLabel(advice.portie)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 pb-2">
                <dt className="text-muted">Liever niet</dt>
                <dd className="text-right font-medium">
                  {advice.donts.length > 0
                    ? advice.donts
                        .map((entry) => entry.toLowerCase())
                        .join(", ")
                    : "Geen uitsluitingen"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 pb-2">
                <dt className="text-muted">Dol op</dt>
                <dd className="text-right font-medium">
                  {advice.likes.length > 0
                    ? advice.likes.map((entry) => entry.toLowerCase()).join(", ")
                    : "Nog geen voorkeur opgegeven"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Maaltijden</dt>
                <dd className="text-right font-medium">{result.mealsPerDay} per dag</dd>
              </div>
            </dl>

            {result.notes.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted">
                {result.notes.map((note) => (
                  <li key={note} className="flex gap-1.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-moss" strokeWidth={2.4} />
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <p className="eyebrow mb-1">Rustig wennen</p>
            <h2 className="text-xl">In vier weken overstappen</h2>
            <p className="mt-1 text-xs text-muted">
              Wissel voer altijd geleidelijk, ook als je dier het nieuwe voer meteen lekker vindt.
            </p>
            <div className="mt-3 space-y-2">
              {TRANSITION.map((row) => (
                <div key={row.week} className="text-xs">
                  <div className="mb-1 flex justify-between">
                    <span className="font-medium">{row.week}</span>
                    <span className="text-muted">
                      {row.newFood}% nieuw · {row.oldFood}% oud
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-bone">
                    <span className="bg-moss" style={{ width: `${row.newFood}%` }} />
                    <span className="bg-line" style={{ width: `${row.oldFood}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {result.warnings.length > 0 ? (
          <section className="border-b border-line px-6 py-5 sm:px-9">
            <div className="rounded-xl border border-ochre/30 bg-ochre-soft/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ochre">
                Let op
              </p>
              <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-muted">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <footer className="bg-paper/60 px-6 py-6 text-xs leading-relaxed text-muted sm:px-9">
          <p className="flex items-start gap-2">
            <PrinterIcon className="mt-0.5 size-3.5 shrink-0 text-moss" strokeWidth={1.8} />
            Bewaar rauw voer in de vriezer en laat het in de koelkast ontdooien. Geef het niet
            langer dan een dag in de koelkast bewaard. Dit advies is een berekening, geen medisch
            advies; twijfel je, overleg dan met je dierenarts.
          </p>
          <div className="no-print mt-5 flex flex-wrap items-center gap-3">
            <Link href="/#advies" className="btn btn-primary">
              Nog een advies maken
            </Link>
            <Link href="/" className="btn btn-ghost">
              Terug naar de startpagina
            </Link>
            <span className="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted/70">
              Advies {advice.id}
            </span>
          </div>
        </footer>
      </article>
    </div>
  );
}
