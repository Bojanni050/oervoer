import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Account aanmaken" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);
  const user = await getCurrentUser();
  if (user) redirect(target);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center">
      <div>
        <p className="eyebrow mb-2">Mijn OerVoer</p>
        <h1 className="text-4xl leading-tight">Bewaar je dieren en adviezen</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Met een account onthoudt de app het gewicht, de wensen en de foto van je dier. Een
          volgend advies is dan zo gemaakt.
        </p>
        <p className="mt-6 rounded-2xl bg-bone/70 p-4 text-xs leading-relaxed text-muted">
          Je wachtwoord wordt versleuteld opgeslagen. Foto&apos;s blijven in de app en zijn alleen
          zichtbaar via de link van je profiel of advies.
        </p>
      </div>

      <RegisterForm next={target} />
    </div>
  );
}
