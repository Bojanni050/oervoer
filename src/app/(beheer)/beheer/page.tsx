import Link from "next/link";
import { ArrowUpRight, ChevronRight, ClipboardList, Package, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { KindBadge, Stat, StatusBadge } from "@/components/ui";
import { dashboardStats, listOrders } from "@/lib/db";
import { formatDate, formatKg, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = dashboardStats();
  const orders = listOrders().slice(0, 6);
  const today = new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <PageHeader
        eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
        title="De slagerij, vandaag."
        description="Alle openstaande orders, picklijsten en de actuele voorraad op één plek."
        actions={
          <>
            <Link href="/beheer/orders/nieuw" className="btn btn-primary">
              <Plus className="size-4" /> Nieuwe order
            </Link>
            <Link href="/beheer/orders" className="btn btn-secondary">
              <ClipboardList className="size-4" /> Alle orders
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Open orders"
          value={stats.openOrders}
          hint="Nog niet afgerond"
          accent="moss"
        />
        <Stat
          label="Picklijsten vandaag"
          value={stats.picklistsToday}
          hint="Gegenereerd sinds middernacht"
          accent="ochre"
        />
        <Stat
          label="Producten in voorraad"
          value={stats.productCount}
          hint={`${stats.totalQty.toLocaleString("nl-NL")} stuks totaal`}
          accent="ink"
        />
        <Stat
          label="Lage voorraad"
          value={stats.lowStockCount}
          hint="Minder dan 5 stuks"
          accent={stats.lowStockCount > 0 ? "rust" : "moss"}
        />
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="eyebrow">Laatste orders</p>
              <h2 className="mt-1 text-xl">Klaar om te pakken</h2>
            </div>
            <Link
              href="/beheer/orders"
              className="group inline-flex items-center gap-1 text-sm font-semibold text-moss"
            >
              Alles
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {orders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Nog geen orders. Maak de eerste aan.
            </p>
          ) : (
            <ul>
              {orders.map((order) => (
                <li key={order.id} className="border-b border-line/70 last:border-b-0">
                  <Link
                    href={`/beheer/orders/${order.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-moss-soft/40"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-moss-soft font-display text-sm text-moss">
                      {initials(order.animal)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate font-semibold">{order.animal}</span>
                        <span className="truncate text-xs text-muted">{order.owner}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <KindBadge kind={order.kind} packageKg={order.packageKg} />
                        <span className="text-xs text-muted">
                          {order.ras === "KAT" ? "Kat" : "Hond"} · {formatKg(order.weight, 1)}
                        </span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right sm:block">
                      <StatusBadge status={order.status} />
                      <span className="mt-1 block text-[0.68rem] text-muted">
                        {formatDate(order.createdAt)}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted/60" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <section className="surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Voorraad</p>
                <h2 className="mt-1 text-xl">Bijna op</h2>
              </div>
              <Package className="size-5 text-muted" strokeWidth={1.7} />
            </div>

            {stats.lowStock.length === 0 ? (
              <p className="mt-5 rounded-xl bg-moss-soft/60 px-4 py-3 text-sm text-moss">
                Alle menuproducten hebben genoeg voorraad.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {stats.lowStock.map((product) => (
                  <li key={product.sku} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{product.name}</span>
                      <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted">
                        {product.typeVlees} · {product.sku}
                      </span>
                    </span>
                    <span
                      className={`num shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        product.qty === 0
                          ? "bg-rust-soft text-rust"
                          : "bg-ochre-soft text-[#7a5722]"
                      }`}
                    >
                      {product.qty}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href="/beheer/voorraad?filter=laag"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-moss"
            >
              Voorraad beheren <ArrowUpRight className="size-4" />
            </Link>
          </section>

          <section className="surface bg-moss p-5 text-white">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/60">
              Werkwijze
            </p>
            <ol className="mt-3 space-y-3 text-sm">
              {[
                ["Order", "Dier, gewicht, pakket en dieetwensen."],
                ["Picklijst", "De wizard verdeelt vis, pens, karkas, orgaan, spier en bot."],
                ["Pakken", "Boek af en de voorraad is direct bijgewerkt."],
              ].map(([title, text], index) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/15 font-mono text-[0.7rem]">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-semibold">{title}</span>
                    <span className="block text-white/70">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
