"use client";

import { useFormStatus } from "react-dom";
import { Check, Loader2, Printer, RefreshCw, Sparkles, Trash2, Undo2 } from "lucide-react";
import {
  deleteOrderAction,
  discardPicklistAction,
  generateAction,
  markDoneAction,
} from "@/app/actions";
import type { OrderStatus } from "@/lib/types";

function GenerateSubmit({ hasPicklist }: { hasPicklist: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : hasPicklist ? (
        <RefreshCw className="size-4" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {pending ? "Samenstellen…" : hasPicklist ? "Opnieuw genereren" : "Picklijst genereren"}
    </button>
  );
}

export function GenerateButton({ orderId, hasPicklist }: { orderId: number; hasPicklist: boolean }) {
  return (
    <form action={generateAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <GenerateSubmit hasPicklist={hasPicklist} />
    </form>
  );
}

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

export function DiscardButton({ orderId }: { orderId: number }) {
  return (
    <form
      action={discardPicklistAction}
      onSubmit={(event) => {
        if (!window.confirm("Picklijst weggooien en de voorraad terugboeken?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" className="btn btn-ghost">
        <Undo2 className="size-4" /> Picklijst intrekken
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
            `Order van ${animal} verwijderen? Een bestaande picklijst wordt teruggeboekt.`,
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
