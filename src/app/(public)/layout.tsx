import Link from "next/link";
import { PawMark } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { initials } from "@/lib/format";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bone/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <PawMark />
            <span className="leading-tight">
              <span className="block font-display text-xl tracking-tight">OerVoer</span>
              <span className="eyebrow">Voedingsadvies</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            <a
              href="#hoe-het-werkt"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink md:block"
            >
              Hoe het werkt
            </a>
            <Link
              href="/beheer"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:block"
            >
              Beheer
            </Link>
            {user ? (
              <Link
                href="/account"
                aria-label="Mijn account"
                className="flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-1.5 pr-3 text-sm font-medium text-ink transition-colors hover:border-moss/40 hover:text-moss"
              >
                <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-moss-soft text-[0.65rem] font-semibold text-moss">
                  {user.photoId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/foto/${user.photoId}`} alt="" className="size-full object-cover" />
                  ) : (
                    initials(user.name)
                  )}
                </span>
                <span className="hidden max-w-28 truncate sm:block">Mijn account</span>
              </Link>
            ) : (
              <Link href="/inloggen" className="btn btn-secondary px-3.5 py-2 text-sm">
                Inloggen
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 lg:py-12">{children}</main>

      <footer className="no-print border-t border-line bg-paper/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-7 text-xs leading-relaxed text-muted sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <p className="max-w-xl">
            OerVoer maakt rauw voer voor honden en katten. Dit advies is een berekening op basis
            van gewicht en wensen, geen medisch advies. Twijfel je over de gezondheid van je
            dier? Overleg met je dierenarts.
          </p>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted/70">
            OerVoer · sinds 2014
          </p>
        </div>
      </footer>
    </div>
  );
}
