"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/account-actions";
import { PhotoField } from "@/components/photo-field";
import type { UserRecord } from "@/lib/types";

export function ProfileForm({ user }: { user: UserRecord }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});

  return (
    <form action={action} className="space-y-4">
      <PhotoField
        label="Profielfoto"
        currentSrc={user.photoId ? `/foto/${user.photoId}` : null}
      />
      <label className="field">
        <span>Naam</span>
        <input className="input" name="name" defaultValue={user.name} required minLength={2} />
      </label>
      <label className="field">
        <span>E-mailadres</span>
        <input className="input" value={user.email} readOnly disabled />
        <span className="text-xs text-muted">Je e-mailadres kan niet worden gewijzigd.</span>
      </label>
      {state.error ? (
        <p className="rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Bezig…" : "Profiel opslaan"}
      </button>
    </form>
  );
}
