import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { OrderForm } from "@/components/order-form";

export const metadata = { title: "Nieuwe order" };

export default function NewOrderPage() {
  return (
    <div>
      <Link
        href="/beheer/orders"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Terug naar orders
      </Link>
      <PageHeader
        eyebrow="Nieuwe order"
        title="Wie krijgt er voer?"
        description="Vul het dier en het pakket in. Daarna genereer je de picklijst op de orderpagina."
      />
      <OrderForm />
    </div>
  );
}
