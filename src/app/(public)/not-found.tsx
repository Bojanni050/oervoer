import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdviceNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="eyebrow mb-2">Advies niet gevonden</p>
      <h1 className="text-3xl">Deze link bestaat niet meer</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Het advies is verwijderd of de link is niet compleet. Maak een nieuw advies; dat kost
        maar een paar stappen.
      </p>
      <Link href="/#advies" className="btn btn-primary mt-6">
        <ArrowLeft className="size-4" strokeWidth={1.9} />
        Nieuw advies maken
      </Link>
    </div>
  );
}
