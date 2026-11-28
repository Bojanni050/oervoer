import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { EmptyState, KindBadge, StatusBadge } from "@/components/ui";
import { listOrders } from "@/lib/db";
import { formatDate, formatKg, initials } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: Array<{ key: OrderStatus | "alle"; label: string }> = [
  { key: "alle", label: "Alles" },
  { key: "nieuw", label: "Nieuw" },
  { key: "afgerond", label: "Afgerond" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const active = (TABS.find((tab) => tab.key === params.status)?.key ?? "alle") as
    | OrderStatus
    | "alle";
  const query = params.q?.trim() ?? "";

  const all = listOrders();
  const orders = listOrders({ status: active, search: query });
  const countFor = (status: OrderStatus | "alle") =>
    status === "alle" ? all.length : all.filter((order) => order.status === status).length;

  return (
    <div>
      <PageHeader
        eyebrow="Orderboek"
        title="Orders"
        description="Elke order is één dier met één pakket. Open een order om de picklijst te maken."
        actions={
          <Link href="/beheer/orders/nieuw" className="btn btn-primary">
            <Plus className="size-4" /> Nieuwe order
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 rounded-full border border-line bg-paper p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/beheer/orders?${new URLSearchParams({
                ...(tab.key !== "alle" ? { status: tab.key } : {}),
                ...(query ? { q: query } : {}),
              }).toString()}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active === tab.key ? "bg-moss text-white" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 font-mono text-[0.68rem] ${
                  active === tab.key ? "text-white/60" : "text-muted/70"
                }`}
              >
                {countFor(tab.key)}
              </span>
            </Link>
          ))}
        </nav>

        <form className="relative" action="/beheer/orders" method="get">
          {active !== "alle" ? <input type="hidden" name="status" value={active} /> : null}
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Zoek dier of eigenaar…"
            className="input w-full pl-9 sm:w-64"
          />
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Geen orders gevonden"
          description={
            query
              ? `Niets gevonden voor “${query}”. Probeer een andere zoekterm.`
              : "Zodra er een order binnenkomt, staat hij hier klaar om te picken."
          }
        >
          <Link href="/beheer/orders/nieuw" className="btn btn-primary">
            <Plus className="size-4" /> Order toevoegen
          </Link>
        </EmptyState>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th>Dier &amp; eigenaar</th>
                <th>Pakket</th>
                <th>Gewicht</th>
                <th>Dieet</th>
                <th>Status</th>
                <th className="text-right">Aangemaakt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const diet = [...order.donts, ...order.prefers.map((value) => `+ ${value}`)];
                return (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/beheer/orders/${order.id}`} className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-moss-soft font-display text-sm text-moss">
                          {initials(order.animal)}
                        </span>
                        <span>
                          <span className="block font-semibold leading-tight">{order.animal}</span>
                          <span className="text-xs text-muted">
                            {order.owner} · {order.ras === "KAT" ? "Kat" : "Hond"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <KindBadge kind={order.kind} />
                    </td>
                    <td className="num">
                      {formatKg(order.packageKg, Number.isInteger(order.packageKg) ? 0 : 1)}
                      <span className="block text-xs text-muted">
                        dier {formatKg(order.weight, order.weight % 1 === 0 ? 0 : 1)}
                      </span>
                    </td>
                    <td>
                      {diet.length === 0 ? (
                        <span className="text-xs text-muted">Geen restricties</span>
                      ) : (
                        <span className="flex max-w-[15rem] flex-wrap gap-1">
                          {diet.slice(0, 3).map((entry) => (
                            <span
                              key={entry}
                              className={`pill ${
                                entry.startsWith("+")
                                  ? "border-moss/25 bg-moss-soft text-moss"
                                  : "border-line bg-bone text-muted"
                              }`}
                            >
                              {entry}
                            </span>
                          ))}
                          {diet.length > 3 ? (
                            <span className="pill border-line bg-bone text-muted">
                              +{diet.length - 3}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="text-right text-xs text-muted">{formatDate(order.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
