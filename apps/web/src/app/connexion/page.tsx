import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { configuredProviders, devLoginEnabled } from "@/lib/env";
import { getCurrentPlayerSafe } from "@/lib/player";

export const metadata: Metadata = { title: "Connexion" };

const DEMO_ACCOUNTS = [
  { handle: "demo-dresseur", label: "Dresseur Démo · 6 boosters, collection vide" },
  { handle: "demo-collection", label: "Collectionneuse Démo · 600 cartes" },
  { handle: "demo-marchand", label: "Marchand Démo · 300 cartes, 0 booster" },
];

function TwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M4.3 3 3 6.4v13.5h4.6V22h2.6l2.4-2.1h3.7L21 15.3V3H4.3Zm15 11.4-2.9 2.9h-4.6l-2.4 2.1v-2.1H5.5V4.7h13.8v9.7ZM16.4 7.9v4.6h-1.7V7.9h1.7Zm-4.6 0v4.6h-1.7V7.9h1.7Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1.1a15.7 15.7 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17a17.1 17.1 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 10.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.4-.7-8.3-3.1-11.7ZM8.5 14.7c-1 0-1.9-.9-1.9-2.1s.8-2.1 1.9-2.1 1.9.9 1.9 2.1-.8 2.1-1.9 2.1Zm7 0c-1 0-1.9-.9-1.9-2.1s.8-2.1 1.9-2.1 1.9.9 1.9 2.1-.8 2.1-1.9 2.1Z" />
    </svg>
  );
}

/** Page de retour après connexion : uniquement un chemin interne. */
function safeNext(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const next = safeNext((await searchParams).suite);
  if (await getCurrentPlayerSafe()) redirect(next);
  const anyProvider = configuredProviders.twitch || configuredProviders.discord;

  return (
    <section className="mx-auto grid max-w-md gap-8 py-16">
      <div className="grid gap-3 text-center">
        <h1 className="font-display text-3xl font-bold">Connexion</h1>
        <p className="text-muted">
          Connecte-toi avec ton compte Twitch ou Discord. On ne récupère que ton pseudo et ton avatar.
        </p>
      </div>

      <div className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        {configuredProviders.twitch && (
          <form
            action={async () => {
              "use server";
              await signIn("twitch", { redirectTo: next });
            }}
          >
            <Button type="submit" variant="secondary" size="lg" className="w-full [&_svg]:size-5">
              <TwitchIcon />
              Continuer avec Twitch
            </Button>
          </form>
        )}
        {configuredProviders.discord && (
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: next });
            }}
          >
            <Button type="submit" variant="secondary" size="lg" className="w-full [&_svg]:size-5">
              <DiscordIcon />
              Continuer avec Discord
            </Button>
          </form>
        )}
        {!anyProvider && (
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
            Aucun fournisseur de connexion n&apos;est configuré. Renseigne <code className="font-mono text-fg">AUTH_TWITCH_ID</code>{" "}
            ou <code className="font-mono text-fg">AUTH_DISCORD_ID</code> dans <code className="font-mono text-fg">.env</code> (voir le
            README).
          </p>
        )}
      </div>

      {devLoginEnabled && (
        <div className="grid gap-3 rounded-[var(--radius-card)] border border-dashed border-lime/50 p-6">
          <h2 className="font-display text-sm font-bold text-lime">Comptes de démo (développement uniquement)</h2>
          <form method="post" action="/api/dev/login" className="grid gap-2">
            <input type="hidden" name="suite" value={next} />
            {DEMO_ACCOUNTS.map((a) => (
              <Button key={a.handle} type="submit" name="handle" value={a.handle} variant="ghost" className="h-auto min-h-11 justify-start py-2 text-left whitespace-normal">
                {a.label}
              </Button>
            ))}
          </form>
        </div>
      )}
    </section>
  );
}
