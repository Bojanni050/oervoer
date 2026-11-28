import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { KindBadge, StatusBadge } from "@/components/ui";
import { DeleteButton, DoneButton, PrintButton } from "@/components/order-actions";
import { getOrder } from "@/lib/db";
import { formatDate, formatKg, initials } from "@/lib/format";
import { PACKAGE_LABELS } from "@/lib/globals";

export const dynamic = "force-dynamic";

/**
 * Orderdetail. Sinds voorraad en picklijsten zijn vervallen is dit een
 * orderregistratie: wie, welk dier, welk pakket en wat het dier niet eet.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  const order = Number.isFinite(orderId) ? getOrder(orderId) : null;
  if (!order) notFound();

  const pakketLabel =
    PACKAGE_LABELS[order.kind as keyof typeof PACKAGE_LABELS] ?? order.kind;

  const rows: Array<[string, string]> = [
    ["Soort", order.ras === "KAT" ? "Kat" : "Hond"],
    ["Gewicht", formatKg(order.weight, 1)],
    ["Pakket", `${pakketLabel} · ${formatKg(order.packageKg, 0)}`],
    ["Porties", order.portie],
    ["Pup of kitten", order.pup ? "Ja" : "Nee"],
    ["Eet niet", order.donts.length > 0 ? order.donts.join(", ") : "—"],
    ["Voorkeur", order.prefers.length > 0 ? order.prefers.join(", ") : "—"],
    ["Aangemaakt", formatDate(order.createdAt)],
    ["Notities", order.notes || "—"],
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Order #${order.id}`}
        title={order.animal}
        description={`${order.owner} · ${order.ras === "KAT" ? "kat" : "hond"} · ${formatKg(order.weight, 1)}`}
        actions={
          <>
            <Link href="/beheer/orders" className="btn btn-ghost">
              <ArrowLeft className="size-4" /> Alle orders
            </Link>
            <PrintButton />
            <DoneButton orderId={order.id} status={order.status} />
            <DeleteButton orderId={order.id} animal={order.animal} />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-moss-soft font-display text-sm text-moss">
                {initials(order.animal)}
              </span>
              <div>
                <p className="text-lg font-semibold">{order.animal}</p>
                <p className="text-xs text-muted">{order.owner}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={order.status} />
              <KindBadge kind={order.kind} packageKg={order.packageKg} />
            </div>
          </div>

          <dl className="mt-6 divide-y divide-line text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-6 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="surface p-5 sm:p-6">
          <p className="eyebrow mb-2">Wat er veranderd is</p>
          <p className="text-sm leading-relaxed text-muted">
            Voorraadbeheer en picklijsten zijn uit de app gehaald. Een order legt nu vast wat de
            klant wil; de producten met hun voedingswaarden staan in de catalogus en het rantsoen
            rekent de site uit bij het advies.
          </p>
          <Link href="/?tab=voercheck" className="btn btn-secondary mt-4">
            Voercheck openen
          </Link>
        </section>
      </div>
    </div>
  );
}
