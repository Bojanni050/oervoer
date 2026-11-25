"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, Package } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/voorraad", label: "Voorraad", icon: Package },
];

function PawMark() {
  return (
    <span className="grid size-10 place-items-center rounded-full bg-moss-soft text-moss">
      <svg viewBox="0 0 32 32" className="size-6" fill="currentColor" aria-hidden>
        <ellipse cx="10" cy="11" rx="3.1" ry="4.1" transform="rotate(-18 10 11)" />
        <ellipse cx="16" cy="8.6" rx="3.1" ry="4.3" />
        <ellipse cx="22" cy="11" rx="3.1" ry="4.1" transform="rotate(18 22 11)" />
        <path d="M16 15c4.4 0 7.6 2.6 7.6 6 0 2.9-2.6 4.6-5 3.9-1.8-.5-3.4-.5-5.2 0-2.4.7-5-1-5-3.9 0-3.4 3.2-6 7.6-6Z" />
      </svg>
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[15.5rem] flex-col border-r border-line bg-paper/70 px-5 py-7 backdrop-blur lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <PawMark />
          <span className="leading-tight">
            <span className="block font-display text-xl tracking-tight">OerVoer</span>
            <span className="eyebrow">Picklist-wizard</span>
          </span>
        </Link>

        <nav className="mt-9 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-moss text-white"
                    : "text-muted hover:bg-moss-soft/70 hover:text-ink"
                }`}
              >
                <Icon className="size-4.5" strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t border-line pt-5">
          <p className="text-xs leading-relaxed text-muted">
            Rauw voer voor honden en katten. Picklijsten op basis van de echte voorraad.
          </p>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted/70">
            OerVoer · sinds 2014
          </p>
        </div>
      </aside>

      <div className="no-print sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-bone/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <PawMark />
          <span className="font-display text-lg">OerVoer</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-moss text-white" : "text-muted"
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.9} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-[2rem] leading-[1.05] sm:text-[2.45rem]">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
