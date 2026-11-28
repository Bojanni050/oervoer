"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { shareVoercheckAction, saveVoercheckAction } from "@/app/voercheck-actions";
import { formatMineral, mineralStatusLabel } from "@/lib/minerals";
import { voercheckSamenvatting, voercheckTotals, type VoercheckItem } from "@/lib/voercheck";
import type { Dier } from "@/lib/types";

export interface VoercheckPet {
  publicId: string;
  name: string;
  ras: Dier;
  pup: boolean;
}

interface CatalogHit {
  id: number;
  name: string;
  brand: string;
  part: string;
  calcium: number | null;
  fosfor: number | null;
  energie: number | null;
  calciumSource: string;
  energieSource: string;
  sourceKey: string;
  weightG: number | null;
}

interface Props {
  pets: VoercheckPet[];
  defaultPetId?: string;
  loggedIn: boolean;
  vandaag: string;
}

const BRON_LABEL: Record<string, string> = {
  darf: "catalogus",
  usda: "USDA",
  nevo: "NEVO",
  eigen: "eigen opgave",
};

export function VoercheckPanel({ pets, defaultPetId, loggedIn, vandaag }: Props) {
  const [petId, setPetId] = useState(defaultPetId ?? pets[0]?.publicId ?? "");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [zoeken, setZoeken] = useState(false);
  const [rows, setRows] = useState<VoercheckItem[]>([]);
  const [melding, setMelding] = useState("");

  const pet = pets.find((entry) => entry.publicId === petId);
  const ras: Dier = pet?.ras ?? "HOND";
  const pup = pet?.pup ?? false;
  const result = useMemo(() => voercheckTotals(rows, ras, pup), [rows, ras, pup]);
  const { totals, report } = result;

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setZoeken(true);
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(term)}&limit=8`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as { hits?: CatalogHit[] };
        setHits(data.hits ?? []);
      } catch {
        // afgebroken zoekopdracht: niets doen
      } finally {
        setZoeken(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const voegToe = (hit: CatalogHit) => {
    setRows((huidig) => [
      ...huidig,
      {
        name: hit.name,
        grams: 100,
        calcium: hit.calcium,
        fosfor: hit.fosfor,
        energie: hit.energie,
        eiwit: null,
        vet: null,
        bron: `${BRON_LABEL[hit.sourceKey] ?? hit.sourceKey}`,
      },
    ]);
    setQuery("");
    setHits([]);
    setMelding("");
  };

  const wijzigGram = (index: number, grams: number) => {
    setRows((huidig) => huidig.map((row, i) => (i === index ? { ...row, grams } : row)));
  };

  const verwijder = (index: number) => {
    setRows((huidig) => huidig.filter((_, i) => i !== index));
  };

  const regelsJson = JSON.stringify(rows);
  const kanBewaren = rows.length > 0 && loggedIn && Boolean(petId);

  return (
    <div className="space-y-8">
      <div className="surface p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Voercheck</p>
            <h2 className="text-xl">Wat voer je nu?</h2>
            <p className="mt-1 text-sm text-muted">
              Zoek een product, vul de grammen in en zie wat je dier binnenkrijgt.{" "}
              {loggedIn
                ? "Je kunt het per dag bewaren in het dieetdagboek van je dier."
                : "Log in om het in een dieetdagboek te bewaren."}
            </p>
          </div>
          {pets.length > 0 ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">Dier</span>
              <select className="input" value={petId} onChange={(event) => setPetId(event.target.value)}>
                {pets.map((entry) => (
                  <option key={entry.publicId} value={entry.publicId}>
                    {entry.name} ({entry.ras === "KAT" ? "kat" : "hond"}
                    {entry.pup ? ", pup" : ""})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="relative">
          <label className="mb-2 block text-sm font-medium" htmlFor="voercheck-zoek">
            Product of ingrediënt
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="voercheck-zoek"
              className="input pl-9"
              placeholder="kipfilet, kipnekken, runderlever, zalm…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </div>
          {query.trim().length >= 2 ? (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-paper shadow-lg">
              {zoeken && hits.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">Zoeken…</li>
              ) : null}
              {!zoeken && hits.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">
                  Niets gevonden. Probeer een algemener woord, of vul de waarden zelf in.
                </li>
              ) : null}
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-mist"
                    onClick={() => voegToe(hit)}
                  >
                    <span>
                      <span className="font-medium">{hit.name}</span>
                      <span className="ml-2 text-xs text-muted">
                        {hit.part || hit.brand} · {BRON_LABEL[hit.sourceKey] ?? hit.sourceKey}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {hit.calcium === null ? "Ca ?" : `Ca ${formatMineral(hit.calcium)}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="mt-6">
            <table className="table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Product</th>
                  <th className="text-right">Gram</th>
                  <th className="text-right">Ca (g)</th>
                  <th className="text-right">P (g)</th>
                  <th className="text-right">kcal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.name}-${index}`}>
                    <td>
                      <span className="font-medium">{row.name}</span>
                      {row.bron ? <span className="ml-2 text-xs text-muted">{row.bron}</span> : null}
                    </td>
                    <td className="text-right">
                      <input
                        className="input w-20 text-right"
                        type="number"
                        min={1}
                        max={5000}
                        step={5}
                        value={row.grams}
                        onChange={(event) => wijzigGram(index, Number(event.target.value))}
                      />
                    </td>
                    <td className="num text-right">
                      {row.calcium === null ? "?" : ((row.grams * row.calcium) / 100).toFixed(2)}
                    </td>
                    <td className="num text-right">
                      {row.fosfor === null ? "?" : ((row.grams * row.fosfor) / 100).toFixed(2)}
                    </td>
                    <td className="num text-right">
                      {row.energie === null ? "?" : Math.round((row.grams * row.energie) / 100)}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-ghost p-1"
                        onClick={() => verwijder(index)}
                        aria-label={`${row.name} verwijderen`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Nog niets ingevuld. Zoek hierboven een product om te beginnen.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tegel label="Totaal" waarde={`${Math.round(totals.grams)} g`} />
          <Tegel
            label="Calcium per 100 g"
            waarde={`${formatMineral(totals.calciumPer100g)} g`}
            hint={`norm ${report.grams > 0 ? "" : ""}${mineralStatusLabel(report.status)}`}
          />
          <Tegel
            label="Ca : P"
            waarde={totals.caP === null ? "—" : `1 : ${(1 / totals.caP).toFixed(2)}`}
          />
          <Tegel
            label="Energie"
            waarde={totals.energie > 0 ? `${Math.round(totals.energie)} kcal` : "—"}
            hint={
              totals.energie > 0
                ? `${Math.round(totals.eiwit)} g eiwit · ${Math.round(totals.vet)} g vet`
                : undefined
            }
          />
        </div>

        <p className="mt-4 text-sm text-muted">{voercheckSamenvatting(result)}</p>
        <p className="mt-2 text-xs text-muted">
          Deze check is een berekening, geen diagnose. Overleg met je dierenarts als je twijfelt
          of je dier goed eet.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={saveVoercheckAction}>
            <input type="hidden" name="petId" value={petId} />
            <input type="hidden" name="day" value={vandaag} />
            <input type="hidden" name="regels" value={regelsJson} />
            <button type="submit" className="btn btn-primary" disabled={!kanBewaren}>
              Bewaar in dagboek
            </button>
          </form>
          <form action={shareVoercheckAction}>
            <input type="hidden" name="petId" value={petId} />
            <input type="hidden" name="petName" value={pet?.name ?? ""} />
            <input type="hidden" name="ras" value={ras} />
            <input type="hidden" name="pup" value={pup ? "1" : "0"} />
            <input type="hidden" name="day" value={vandaag} />
            <input type="hidden" name="regels" value={regelsJson} />
            <button type="submit" className="btn btn-secondary" disabled={rows.length === 0}>
              Deel-link maken
            </button>
          </form>
          {rows.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setRows([]);
                setMelding("Lijst leeggemaakt.");
              }}
            >
              <Plus className="size-4 rotate-45" /> Leegmaken
            </button>
          ) : null}
        </div>
        {melding ? <p className="mt-3 text-sm text-muted">{melding}</p> : null}
        {!loggedIn ? (
          <p className="mt-3 text-xs text-muted">
            Zonder account kun je wel rekenen en een deel-link maken, maar niet bewaren.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Tegel({ label, waarde, hint }: { label: string; waarde: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-mist/40 p-4">
      <p className="eyebrow mb-1">{label}</p>
      <p className="text-lg font-medium">{waarde}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
