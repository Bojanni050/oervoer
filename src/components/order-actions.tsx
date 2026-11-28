"use client";

import { useFormStatus } from "react-dom";
import { Check, Printer, Trash2 } from "lucide-react";
import { deleteOrderAction, markDoneAction } from "@/app/actions";
import type { OrderStatus } from "@/lib/types";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
      <Printer className="size-4" /> Printen
    </button>
  );
}

export function DoneButton({ orderId, status }: { orderId: number; status: OrderStatus }) {
  if (status === "afgerond") return null;
  return (
    <form action={markDoneAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" className="btn btn-secondary">
        <Check className="size-4" /> Afronden
      </button>
    </form>
  );
}

export function DeleteButton({ orderId, animal }: { orderId: number; animal: string }) {
  return (
    <form
      action={deleteOrderAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Order van ${animal} verwijderen?`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" className="btn btn-ghost text-rust hover:text-rust" title="Verwijderen">
        <Trash2 className="size-4" />
        <span className="sr-only">Order verwijderen</span>
      </button>
    </form>
  );
}
