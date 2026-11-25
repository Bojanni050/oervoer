import type { OrderStatus, PackageKind } from "@/lib/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  nieuw: "border-ochre/35 bg-ochre-soft text-[#7a5722]",
  picklist: "border-moss/25 bg-moss-soft text-moss",
  afgerond: "border-line bg-bone text-muted",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  nieuw: "Nieuw",
  picklist: "Picklijst",
  afgerond: "Afgerond",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`pill ${STATUS_STYLES[status]}`}>
      <span
        className={`size-1.5 rounded-full ${
          status === "nieuw" ? "bg-ochre" : status === "picklist" ? "bg-moss" : "bg-muted/50"
        }`}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function KindBadge({ kind, packageKg }: { kind: PackageKind; packageKg?: number }) {
  return (
    <span className="pill border-line bg-white text-ink">
      <span className="font-mono text-[0.68rem] uppercase tracking-wide">
        {kind === "100" ? "100%" : kind}
      </span>
      {packageKg ? <span className="text-muted">{packageKg} kg</span> : null}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = "moss",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "moss" | "ochre" | "rust" | "ink";
}) {
  const accentClass = {
    moss: "text-moss",
    ochre: "text-ochre",
    rust: "text-rust",
    ink: "text-ink",
  }[accent];

  return (
    <div className="surface px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-2 font-display text-[2.1rem] leading-none ${accentClass}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper/60 px-6 py-10 text-center">
      <p className="font-display text-xl">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-5 flex justify-center gap-2">{children}</div> : null}
    </div>
  );
}
