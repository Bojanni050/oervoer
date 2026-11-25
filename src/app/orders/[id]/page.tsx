import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FlaskConical,
  Stethoscope,
  Utensils,
} from "lucide-react";
import { PageHeader } from "@/components/shell";
import { EmptyState, KindBadge, StatusBadge } from "@/components/ui";
import {
  DeleteButton,
  DiscardButton,
  DoneButton,
  GenerateButton,
  PrintButton,
} from "@/components/order-actions";
import { getOrder, getPicklist } from "@/lib/db";
import { formatDate, formatDateTime, formatGram, formatKg, initials } from "@/lib/format";
import { PACKAGE_LABELS } from "@/lib/globals";
import type { PicklistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fout?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const order = getOrder(orderId);
  if (!order) notFound();

  const picklist = getPicklist(orderId);
  const groups: Array<{ type: string; items: PicklistItem[]; count: number; kg: number }> = [];
  for (const item of picklist?.items ?? []) {
    let group = groups.find((entry) => entry.type === item.typeVlees);
    if (!group) {
      group = { type: item.typeVlees, items: [], count: 0, kg: 0 };
      groups.push(group);
    }
    group.items.push(item);
    group.count += item.count;
    group.kg += item.totalKg;
  }

  const dailyMeal = picklist ? picklist.mealSize * 2 : 0;

  return (
    <div className="print-shell">
      <div className="no-print">
        <Link
          href="/orders"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Alle orders
        </Link>
      </div>

      <div className="mb-7 hidden print:mb-6 print:block">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          OerVoer · Picklijst
        </p>
        <h1 className="mt-1 text-3xl">
          {order.animal} — {order.owner}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {PACKAGE_LABELS[order.kind]} · {formatKg(order.packageKg, 1)} ·{" "}
          {formatDate(picklist?.createdAt ?? order.createdAt)}
        </p>
      </div>

      <div className="no-print">
        <PageHeader
          eyebrow={order.owner}
          title={order.animal}
          description={`${order.ras === "KAT" ? "Kat" : "Hond"} van ${formatKg(order.weight, 1)} · ${
            PACKAGE_LABELS[order.kind]
          } pakket van ${formatKg(order.packageKg, Number.isInteger(order.packageKg) ? 0 : 1)}`}
          actions={
            <>
              <GenerateButton orderId={order.id} hasPicklist={Boolean(picklist)} />
              <PrintButton />
              <DoneButton orderId={order.id} status={order.status} />
              <DeleteButton orderId={order.id} animal={order.animal} />
            </>
          }
        />
      </div>

      {query.fout ? (
        <p className="no-print mb-5 flex items-start gap-2 rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {query.fout}
        </p>
      ) : null}

      <div className="order-grid grid gap-5 lg:grid-cols-[19rem_1fr]">
        <div className="space-y-5">
          <section className="surface overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-12 place-items-center rounded-full bg-moss-soft font-display text-lg text-moss">
                {initials(order.animal)}
              </span>
              <div>
                <p className="font-semibold leading-tight">{order.animal}</p>
                <p className="text-xs text-muted">
                  {order.ras === "KAT" ? "Kat" : "Hond"}
                  {order.pup ? " · pup" : ""}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-line/70 px-5 text-sm">
              {[
                ["Gewicht", formatKg(order.weight, order.weight % 1 === 0 ? 0 : 1)],
                ["Pakket", `${PACKAGE_LABELS[order.kind]} · ${formatKg(order.packageKg, Number.isInteger(order.packageKg) ? 0 : 1)}`],
                ["Portie", order.portie === "beide" ? "Vrij" : order.portie],
                ["Picklijst", picklist ? formatDateTime(picklist.createdAt) : "Nog niet gemaakt"],
                [
                  "Maaltijd",
                  picklist ? `${Math.round(picklist.mealSize * 1000)} g per maaltijd` : "—",
                ],
                ["Pakketduur", picklist ? `${picklist.days} dagen` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-line px-5 py-4">
              <p className="eyebrow mb-2">Dieet</p>
              {order.donts.length === 0 && order.prefers.length === 0 ? (
                <p className="text-sm text-muted">Geen restricties of voorkeuren.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {order.donts.map((entry) => (
                    <span key={`d-${entry}`} className="pill border-rust/25 bg-rust-soft text-rust">
                      {entry}
                    </span>
                  ))}
                  {order.prefers.map((entry) => (
                    <span key={`p-${entry}`} className="pill border-moss/25 bg-moss-soft text-moss">
                      + {entry}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {order.notes ? (
              <div className="border-t border-line px-5 py-4">
                <p className="eyebrow mb-1.5">Notitie</p>
                <p className="text-sm leading-relaxed">{order.notes}</p>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <StatusBadge status={order.status} />
              <span className="text-xs text-muted">Sinds {formatDate(order.createdAt)}</span>
            </div>
          </section>

          <section className="surface no-print p-5">
            <p className="eyebrow mb-3">Samenstelling</p>
            <ul className="space-y-2.5 text-sm text-muted">
              <li className="flex items-start gap-2.5">
                <Utensils className="mt-0.5 size-4 shrink-0 text-moss" />
                <span>
                  <strong className="text-ink">Ongeveer 15% vis</strong> en 15% pens (alleen bij
                  honden), als vast onderdeel van het menu.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <FlaskConical className="mt-0.5 size-4 shrink-0 text-moss" />
                <span>
                  De rest wordt verdeeld over compleet karkas, orgaan, spiervlees en bot volgens de
                  vaste verhoudingen.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Stethoscope className="mt-0.5 size-4 shrink-0 text-moss" />
                <span>
                  Vermijdingen en smaakvoorkeuren worden bij elke selectie meegenomen. Voorkeur
                  weegt vier keer zwaarder.
                </span>
              </li>
            </ul>
          </section>
        </div>

        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="eyebrow">Picklijst</p>
              <h2 className="mt-1 text-xl">
                {picklist ? `${picklist.items.length} regels om te pakken` : "Nog geen picklijst"}
              </h2>
            </div>
            {picklist ? (
              <div className="no-print flex items-center gap-2">
                <a
                  href={`/orders/${order.id}/export`}
                  className="btn btn-secondary"
                  download
                >
                  <Download className="size-4" /> CSV
                </a>
                <DiscardButton orderId={order.id} />
              </div>
            ) : null}
          </div>

          {!picklist ? (
            <div className="p-5">
              <EmptyState
                title="Klaar om samen te stellen"
                description="De wizard pakt de actuele voorraad en stelt een menu samen dat past bij dit dier, dit pakket en het dieet. Je kunt daarna opnieuw genereren of de picklijst intrekken."
              >
                <GenerateButton orderId={order.id} hasPicklist={false} />
              </EmptyState>
            </div>
          ) : (
            <>
              {picklist.warnings.length > 0 ? (
                <div className="border-b border-line bg-ochre-soft/60 px-5 py-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#7a5722]">
                    <AlertTriangle className="size-4" /> Let op bij het pakken
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[#7a5722]/90">
                    {picklist.warnings.map((warning, index) => (
                      <li key={`${warning.type}-${index}`}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="table min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="w-16">Aantal</th>
                      <th>Product</th>
                      <th>Vak</th>
                      <th className="text-right">Per stuk</th>
                      <th className="text-right">Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <Fragment key={`group-${group.type}`}>
                        <tr className="bg-moss-soft/50">
                          <td colSpan={5} className="py-2">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-moss">
                                {group.type}
                              </span>
                              <span className="num text-xs text-moss/70">
                                {group.count} stuks · {formatKg(group.kg)}
                              </span>
                            </span>
                          </td>
                        </tr>
                        {group.items.map((item) => (
                          <tr key={item.sku}>
                            <td className="num font-display text-lg">{item.count}×</td>
                            <td>
                              <span className="font-medium">{item.name}</span>
                              <span className="mt-0.5 block font-mono text-[0.62rem] uppercase tracking-wide text-muted">
                                {item.sku}
                                {item.smaak ? ` · ${item.smaak}` : ""}
                              </span>
                            </td>
                            <td className="text-xs text-muted">{item.shelf || "—"}</td>
                            <td className="num text-right">{formatGram(item.weight)}</td>
                            <td className="num text-right font-medium">{formatGram(item.totalKg)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
                <div className="bg-paper px-5 py-4">
                  <p className="eyebrow">Totaal gewicht</p>
                  <p className="num mt-1 font-display text-2xl">{formatKg(picklist.totalKg)}</p>
                </div>
                <div className="bg-paper px-5 py-4">
                  <p className="eyebrow">Per maaltijd</p>
                  <p className="num mt-1 font-display text-2xl">
                    {Math.round(picklist.mealSize * 1000)} g
                  </p>
                </div>
                <div className="bg-paper px-5 py-4">
                  <p className="eyebrow">Dagrantsoen</p>
                  <p className="num mt-1 font-display text-2xl">{Math.round(dailyMeal * 1000)} g</p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
