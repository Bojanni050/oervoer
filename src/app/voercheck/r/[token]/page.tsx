import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDietReport } from "@/lib/db";
import { formatMineral, mineralStatusLabel, type MineralReport } from "@/lib/minerals";

export const metadata: Metadata = {
  title: "Voercheck",
  robots: { index: false, follow: false },
};

interface Regel {
  name: string;
  grams: number;
  calcium: number | null;
  fosfor: number | null;
  energie: number | null;
  bron?: string;
}

export default async function VoercheckRapportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = getDietReport(token);
  if (!report) notFound();

  const regels = (report.items as Regel[]) ?? [];
  const totals = (report.totals as MineralReport) ?? null;
  const som = regels.reduce(
    (acc, regel) => ({
      grams: acc.grams + regel.grams,
      calcium: acc.calcium + ((regel.calcium ?? 0) * regel.grams) / 100,
      fosfor: acc.fosfor + ((regel.fosfor ?? 0) * regel.grams) / 100,
      energie: acc.energie + ((regel.energie ?? 0) * regel.grams) / 100,
    }),
    { grams: 0, calcium: 0, fosfor: 0, energie: 0 },
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10">
      <header>
        <p className="eyebrow mb-2">Voercheck</p>
        <h1 className="text-3xl">
          {report.petName ? `${report.petName} — ` : ""}
          {report.day}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {report.ras === "KAT" ? "Kat" : "Hond"}
          {report.pup ? " (pup)" : ""} · gedeelde momentopname van{" "}
          {new Date(report.createdAt).toLocaleDateString("nl-NL")}
        </p>
      </header>

      <section className="surface p-5 sm:p-6">
        <table className="table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Product</th>
              <th className="text-right">Gram</th>
              <th className="text-right">Ca (g)</th>
              <th className="text-right">P (g)</th>
              <th className="text-right">kcal</th>
            </tr>
          </thead>
          <tbody>
            {regels.map((regel, index) => (
              <tr key={`${regel.name}-${index}`}>
                <td>
                  {regel.name}
                  {regel.bron ? <span className="ml-2 text-xs text-muted">{regel.bron}</span> : null}
                </td>
                <td className="num text-right">{regel.grams}</td>
                <td className="num text-right">
                  {regel.calcium === null ? "?" : ((regel.grams * regel.calcium) / 100).toFixed(2)}
                </td>
                <td className="num text-right">
                  {regel.fosfor === null ? "?" : ((regel.grams * regel.fosfor) / 100).toFixed(2)}
                </td>
                <td className="num text-right">
                  {regel.energie === null ? "?" : Math.round((regel.grams * regel.energie) / 100)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="font-medium">Totaal</td>
              <td className="num text-right font-medium">{Math.round(som.grams)}</td>
              <td className="num text-right font-medium">{som.calcium.toFixed(2)}</td>
              <td className="num text-right font-medium">{som.fosfor.toFixed(2)}</td>
              <td className="num text-right font-medium">{Math.round(som.energie)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-mist/40 p-4">
          <p className="eyebrow mb-1">Calcium per 100 g</p>
          <p className="text-lg font-medium">
            {som.grams > 0 ? `${formatMineral((som.calcium / som.grams) * 100)} g` : "—"}
          </p>
          {totals ? <p className="mt-1 text-xs text-muted">{mineralStatusLabel(totals.status)}</p> : null}
        </div>
        <div className="rounded-xl border border-line bg-mist/40 p-4">
          <p className="eyebrow mb-1">Ca : P</p>
          <p className="text-lg font-medium">
            {som.fosfor > 0 ? `1 : ${(som.fosfor / som.calcium).toFixed(2)}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-mist/40 p-4">
          <p className="eyebrow mb-1">Energie</p>
          <p className="text-lg font-medium">{som.energie > 0 ? `${Math.round(som.energie)} kcal` : "—"}</p>
        </div>
      </section>

      {totals ? <p className="text-sm text-muted">{totals.message}</p> : null}

      <p className="text-xs text-muted">
        Deze check is een berekening, geen diagnose. Overleg met je dierenarts als je twijfelt of je
        dier goed eet. Voedingswaarden komen uit de productcatalogus (opgave van de fabrikant) of uit
        de USDA-dataset; per regel staat de herkomst vermeld.
      </p>

      <Link href="/?tab=voercheck" className="btn btn-secondary no-print">
        Zelf een voercheck maken
      </Link>
    </div>
  );
}
