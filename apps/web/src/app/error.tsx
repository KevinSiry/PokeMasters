"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Erreur inattendue pendant le rendu d'une page : on le dit simplement et on propose de réessayer. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section role="alert" className="grid justify-items-center gap-5 py-24 text-center">
      <p className="font-display text-5xl font-bold text-prism">Oups</p>
      <h1 className="font-display text-xl font-bold">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="max-w-[44ch] text-muted">
        Un souci de notre côté, rien n&apos;a été perdu. Réessaie dans un instant ; si ça continue, reviens à l&apos;accueil.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Réessayer
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Accueil</Link>
        </Button>
      </div>
    </section>
  );
}
