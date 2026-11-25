import type { Metadata } from "next";
import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Inloggen" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);
  const user = await getCurrentUser();
  if (user) redirect(target);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
      <div>
        <p className="eyebrow mb-2">Mijn OerVoer</p>
        <h1 className="text-4xl leading-tight">Welkom terug</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Log in om je dieren en hun adviezen terug te vinden. Je kunt ze daarna met één klik
          opnieuw bekijken of printen.
        </p>
        <ul className="mt-6 space-y-2.5 text-sm text-muted">
          {[
            "Al je dieren met foto op één plek",
            "Elk advies bewaard met een eigen link",
            "Nieuwe adviezen beginnen met de gegevens van je dier",
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-moss" strokeWidth={2.4} />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <LoginForm next={target} />
    </div>
  );
}
