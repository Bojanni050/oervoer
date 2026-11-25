"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { loginAction, registerAction } from "@/app/account-actions";
import { PhotoField } from "@/components/photo-field";

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
      {error}
    </p>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="surface space-y-4 p-6 sm:p-7">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>E-mailadres</span>
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="jij@voorbeeld.nl"
        />
      </label>
      <label className="field">
        <span>Wachtwoord</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <ErrorNote error={state.error} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? "Bezig…" : "Inloggen"}
        <ArrowRight className="size-4" strokeWidth={1.9} />
      </button>
      <p className="text-center text-sm text-muted">
        Nog geen account?{" "}
        <Link
          href={`/registreren?next=${encodeURIComponent(next)}`}
          className="font-medium text-moss hover:underline"
        >
          Maak er een aan
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, {});

  return (
    <form action={action} className="surface space-y-4 p-6 sm:p-7">
      <input type="hidden" name="next" value={next} />
      <PhotoField label="Profielfoto (optioneel)" />
      <label className="field">
        <span>Naam</span>
        <input
          className="input"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          placeholder="Voor- en achternaam"
        />
      </label>
      <label className="field">
        <span>E-mailadres</span>
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="jij@voorbeeld.nl"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>Wachtwoord</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        <label className="field">
          <span>Herhaal wachtwoord</span>
          <input
            className="input"
            type="password"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Minimaal 8 tekens. Je gegevens blijven in deze app; we sturen geen e-mail.
      </p>
      <ErrorNote error={state.error} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? "Bezig…" : "Account aanmaken"}
        <ArrowRight className="size-4" strokeWidth={1.9} />
      </button>
      <p className="text-center text-sm text-muted">
        Heb je al een account?{" "}
        <Link
          href={`/inloggen?next=${encodeURIComponent(next)}`}
          className="font-medium text-moss hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
