import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cat, Dog, Plus, Printer, UserRound } from "lucide-react";
import { deletePetAction, logoutAction } from "@/app/account-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { ProfileForm } from "@/components/profile-form";
import { formatAdviceGrams, styleLabel } from "@/lib/advice";
import { requireUser } from "@/lib/auth";
import { listAdvicesForUser, listPets } from "@/lib/db";
import { formatDate, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Mijn account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ opgeslagen?: string; fout?: string }>;
}) {
  const user = await requireUser("/account");
  const { opgeslagen, fout } = await searchParams;
  const pets = listPets(user.id);
  const advices = listAdvicesForUser(user.id);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Mijn OerVoer</p>
          <h1 className="text-4xl leading-tight">Hallo {user.name.split(" ")[0]}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Hier bewaar je de gegevens van je dieren en elk advies dat je hebt gemaakt.
          </p>
        </div>
        <Link href="/account/dieren/nieuw" className="btn btn-primary">
          <Plus className="size-4" strokeWidth={2} />
          Nieuw dier
        </Link>
      </header>

      {opgeslagen ? (
        <p className="rounded-xl border border-moss/25 bg-moss-soft px-4 py-3 text-sm text-moss">
          {opgeslagen === "profiel" ? "Je profiel is opgeslagen." : "Je dier is opgeslagen."}
        </p>
      ) : null}

      {fout === "geen-toegang" ? (
        <p className="rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
          Je account heeft geen toegang tot beheer. Vraag een beheerder om je rechten.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <aside className="surface p-5">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-moss-soft font-display text-lg text-moss">
              {user.photoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/foto/${user.photoId}`} alt="" className="size-full object-cover" />
              ) : (
                initials(user.name)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-tight">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            <UserRound className="size-3.5" strokeWidth={1.8} />
            Lid sinds {formatDate(user.createdAt)}
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <ProfileForm user={user} />
          </div>

          {user.role === "admin" ? (
            <Link href="/beheer" className="btn btn-secondary mt-4 w-full justify-center text-xs">
              Naar beheer
              <ArrowRight className="size-3.5" strokeWidth={1.9} />
            </Link>
          ) : null}

          <form action={logoutAction} className="mt-4 border-t border-line pt-4">
            <button type="submit" className="text-xs font-medium text-muted hover:text-rust">
              Uitloggen
            </button>
          </form>
        </aside>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-2xl">Mijn dieren</h2>
            <span className="text-xs text-muted">
              {pets.length === 1 ? "1 dier" : `${pets.length} dieren`}
            </span>
          </div>

          {pets.length === 0 ? (
            <div className="surface flex flex-col items-start gap-3 p-6">
              <span className="grid size-10 place-items-center rounded-full bg-moss-soft text-moss">
                <Cat className="size-5" strokeWidth={1.8} />
              </span>
              <div>
                <p className="font-display text-lg">Nog geen dieren opgeslagen</p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                  Voeg je hond of kat toe met gewicht, wensen en een foto. Dan hoef je dat bij een
                  volgend advies niet opnieuw in te vullen.
                </p>
              </div>
              <Link href="/account/dieren/nieuw" className="btn btn-secondary">
                Eerste dier toevoegen
                <ArrowRight className="size-4" strokeWidth={1.9} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pets.map((pet) => (
                <article key={pet.id} className="surface flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-bone text-muted">
                      {pet.photoId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/foto/${pet.photoId}`}
                          alt={pet.name}
                          className="size-full object-cover"
                        />
                      ) : pet.ras === "KAT" ? (
                        <Cat className="size-6" strokeWidth={1.7} />
                      ) : (
                        <Dog className="size-6" strokeWidth={1.7} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-xl leading-tight">{pet.name}</h3>
                      <p className="text-xs text-muted">
                        {pet.ras === "KAT" ? "Kat" : "Hond"} ·{" "}
                        {String(pet.weight).replace(".", ",")} kg
                        {pet.pup ? " · pup" : ""}
                      </p>
                    </div>
                  </div>

                  {pet.donts.length > 0 ? (
                    <p className="mt-3 flex flex-wrap gap-1.5 text-[0.68rem] text-muted">
                      {pet.donts.slice(0, 4).map((dont) => (
                        <span key={dont} className="rounded-full bg-rust-soft px-2 py-0.5 text-rust">
                          geen {dont.toLowerCase()}
                        </span>
                      ))}
                    </p>
                  ) : null}

                  {pet.notes ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                      {pet.notes}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Link
                      href={`/?dier=${pet.publicId}#advies`}
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      Advies maken
                    </Link>
                    <Link
                      href={`/account/dieren/${pet.publicId}`}
                      className="btn btn-ghost px-3 py-1.5 text-xs"
                    >
                      Bewerken
                    </Link>
                    <form action={deletePetAction} className="ml-auto">
                      <input type="hidden" name="petId" value={pet.publicId} />
                      <ConfirmButton
                        message={`Weet je zeker dat je ${pet.name} wilt verwijderen? Opgeslagen adviezen blijven bestaan.`}
                        className="text-xs text-muted hover:text-rust"
                      >
                        Verwijderen
                      </ConfirmButton>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl">Mijn adviezen</h2>
            <p className="mt-1 text-sm text-muted">Elk advies blijft bewaard met een eigen link.</p>
          </div>
          <span className="text-xs text-muted">
            {advices.length === 1 ? "1 advies" : `${advices.length} adviezen`}
          </span>
        </div>

        {advices.length === 0 ? (
          <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="max-w-md text-sm leading-relaxed text-muted">
              Je hebt nog geen advies gemaakt. Start de wizard; als je bent ingelogd, wordt het
              resultaat automatisch aan je account gekoppeld.
            </p>
            <Link href="/#advies" className="btn btn-secondary">
              Advies maken
              <ArrowRight className="size-4" strokeWidth={1.9} />
            </Link>
          </div>
        ) : (
          <div className="surface divide-y divide-line">
            {advices.map((advice) => (
              <article
                key={advice.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bone text-muted">
                  {advice.ras === "KAT" ? (
                    <Cat className="size-4" strokeWidth={1.8} />
                  ) : (
                    <Dog className="size-4" strokeWidth={1.8} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {advice.animal || "Naamloos advies"}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {styleLabel(advice.kind)} · {advice.packageKg} kg
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {formatAdviceGrams(advice.result.dailyGrams)} per dag ·{" "}
                    {formatDate(advice.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/advies/${advice.id}`}
                  className="btn btn-ghost px-3 py-1.5 text-xs"
                >
                  Bekijken
                  <ArrowRight className="size-3.5" strokeWidth={1.9} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <Printer className="size-3.5" strokeWidth={1.8} />
        Elk advies heeft een printknop. Handig om het aan je dierenarts te laten zien.
      </p>
    </div>
  );
}
