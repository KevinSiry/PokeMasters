"use client";

import { gameConfig, type Tier } from "@pokeflex/config";
import { Check, Search, Shuffle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { stakeCandidatesAction } from "@/app/duels/actions";
import { CardImage } from "@/components/card-image";
import { TIER_ICON, TIER_TEXT } from "@/components/tier-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StakeCandidate {
  copyId: string;
  cardId: string;
  name: string;
  image: string | null;
  tier: Tier;
  setName: string;
}

const SIZE = gameConfig.duels.stakeSize;

function randomPick(list: StakeCandidate[]): string[] {
  const pool = list.filter((c) => c.image);
  const src = pool.length >= SIZE ? pool : list;
  const copy = [...src];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, SIZE).map((c) => c.copyId);
}

/**
 * Choix des cartes misées. Trois cartes au hasard sont proposées d'emblée ; elles nourrissent
 * les questions du duel et reviennent à la fin.
 */
export function StakePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [list, setList] = useState<StakeCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    void stakeCandidatesAction().then((res) => {
      if (!alive) return;
      if (!res.ok) return setError(res.error);
      setList(res.data);
      if (value.length === 0) onChange(randomPick(res.data));
    });
    return () => {
      alive = false;
    };
    // Chargé une fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    if (!list) return [];
    const needle = q.trim().toLowerCase();
    const filtered = needle ? list.filter((c) => c.name.toLowerCase().includes(needle) || c.setName.toLowerCase().includes(needle)) : list;
    // Les cartes choisies restent en tête.
    return [...filtered.filter((c) => value.includes(c.copyId)), ...filtered.filter((c) => !value.includes(c.copyId))].slice(0, 60);
  }, [list, q, value]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!list) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-busy="true" aria-label="Chargement de tes cartes">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[63/88] animate-pulse rounded-lg bg-elev" />
        ))}
      </div>
    );
  }
  if (list.length < SIZE) {
    return (
      <p className="rounded-xl border border-line bg-bg p-4 text-sm text-muted">
        Il te faut au moins {SIZE} cartes différentes disponibles pour miser. Ouvre quelques boosters, puis reviens !
      </p>
    );
  }

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (value.length < SIZE) onChange([...value, id]);
    else onChange([...value.slice(1), id]);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Chercher une carte</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher dans tes cartes"
            className="h-10 w-full rounded-full border border-line bg-bg pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange(randomPick(list))}>
          <Shuffle aria-hidden="true" />
          Au hasard
        </Button>
      </div>
      <p className="text-xs text-muted" aria-live="polite">
        {value.length}/{SIZE} cartes choisies · elles te reviennent à la fin du duel
      </p>
      <ul className="grid max-h-[42vh] grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
        {shown.map((c) => {
          const idx = value.indexOf(c.copyId);
          const on = idx >= 0;
          return (
            <li key={c.copyId}>
              <button
                type="button"
                onClick={() => toggle(c.copyId)}
                aria-pressed={on}
                aria-label={`${c.name}, ${c.setName}`}
                className={cn(
                  "relative block w-full rounded-lg transition-transform active:scale-95",
                  on ? "ring-3 ring-lime ring-offset-2 ring-offset-surface" : "opacity-80 hover:opacity-100",
                )}
              >
                <CardImage image={c.image} name={c.name} className="rounded-lg" />
                <span className={cn("absolute top-1 left-1 rounded-full bg-bg/85 px-1.5 text-[10px] leading-4", TIER_TEXT[c.tier])} aria-hidden="true">
                  {TIER_ICON[c.tier]}
                </span>
                {on && (
                  <span className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-lime text-xs font-bold text-bg shadow">
                    {idx + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {value.length === SIZE && (
        <p className="flex items-center gap-1.5 text-xs text-lime">
          <Check aria-hidden="true" className="size-3.5" /> Mise prête
        </p>
      )}
    </div>
  );
}
