import { gameConfig } from "@pokeflex/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos et mentions",
  description: "PokeFlex est un fan game gratuit, non officiel et non commercial. Mentions légales et crédits.",
};

const minutes = gameConfig.boosters.refillIntervalMs / 60_000;

export default function AProposPage() {
  return (
    <article className="mx-auto grid max-w-[68ch] gap-10 py-14 leading-relaxed">
      <header className="grid gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">À propos de PokeFlex</h1>
        <p className="text-lg text-muted">
          Un jeu de collection gratuit, fait par des fans, pour le plaisir de revoir toutes les cartes sorties depuis
          1999.
        </p>
      </header>

      <section className="grid gap-3" aria-labelledby="principe">
        <h2 id="principe" className="font-display text-xl font-bold">
          Le principe
        </h2>
        <p>
          Chaque carte du jeu de cartes à collectionner réel est une carte de PokeFlex. Tu reçois un booster gratuit de{" "}
          {gameConfig.boosters.size} cartes toutes les {minutes} minutes (jusqu&apos;à {gameConfig.boosters.maxStock} en
          réserve). Tu peux recycler tes doubles contre des Jetons, acheter des boosters d&apos;un set précis, échanger
          au marché entre joueurs et miser des cartes dans des duels de quiz.
        </p>
        <p className="text-muted">
          Le concept s&apos;inspire de WikiMasters, le jeu qui transforme les articles Wikipédia en cartes à
          collectionner.
        </p>
      </section>

      <section className="grid gap-3" aria-labelledby="mentions">
        <h2 id="mentions" className="font-display text-xl font-bold">
          Mentions
        </h2>
        <ul className="grid list-disc gap-2 pl-5 marker:text-coral">
          <li>
            PokeFlex est un <strong>projet de fan non officiel</strong>. Il n&apos;est ni affilié, ni soutenu, ni
            approuvé par The Pokémon Company, Nintendo, Creatures Inc. ou Game Freak.
          </li>
          <li>
            Pokémon, les noms des Pokémon et les illustrations des cartes sont des marques et des œuvres appartenant à
            leurs détenteurs respectifs.
          </li>
          <li>
            Le projet est <strong>non commercial</strong> : aucun paiement, aucune publicité. Les Jetons sont une
            monnaie fictive sans aucune valeur réelle ; ils ne peuvent être ni achetés, ni vendus, ni convertis.
          </li>
          <li>
            Les données et les images des cartes sont fournies par{" "}
            <a href="https://tcgdex.dev" className="text-accent underline underline-offset-4" rel="noopener" target="_blank">
              TCGdex
            </a>
            , une API ouverte maintenue par sa communauté. Les images sont chargées directement depuis son CDN et ne sont
            pas ré-hébergées.
          </li>
        </ul>
      </section>

      <section className="grid gap-3" aria-labelledby="donnees">
        <h2 id="donnees" className="font-display text-xl font-bold">
          Tes données
        </h2>
        <p>
          La connexion passe par Twitch ou Discord. PokeFlex conserve ton identifiant chez ce fournisseur, ton pseudo et
          ton avatar, ainsi que ta collection et ton historique de jeu. Rien n&apos;est revendu ni partagé.
        </p>
      </section>
    </article>
  );
}
