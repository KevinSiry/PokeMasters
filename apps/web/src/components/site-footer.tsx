import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line/70 pb-20 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 text-sm text-muted sm:grid-cols-[1fr_auto] sm:items-start">
        <p className="max-w-prose leading-relaxed">
          PokeFlex est un projet de fan <strong className="text-fg">non officiel et non commercial</strong>, non affilié
          à The Pokémon Company, Nintendo, Creatures ou Game Freak. Pokémon et les illustrations des cartes
          appartiennent à leurs détenteurs respectifs. Données et images fournies par{" "}
          <a href="https://tcgdex.dev" className="text-accent underline-offset-4 hover:underline" rel="noopener" target="_blank">
            TCGdex
          </a>
          . Les Jetons n&apos;ont aucune valeur réelle.
        </p>
        <nav aria-label="Liens de bas de page" className="flex gap-4">
          <Link href="/a-propos" className="text-fg underline-offset-4 hover:underline">
            À propos et mentions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
