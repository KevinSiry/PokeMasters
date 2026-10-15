"use client";

import { CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { BoosterPackArt } from "@/components/booster/booster-pack";
import { Jetons } from "@/components/jetons";
import { ProgressBar } from "@/components/progress";
import { cn } from "@/lib/utils";

interface ShopSet {
  id: string;
  name: string;
  logo: string | null;
  cover: string | null;
  serieId: string;
  serieName: string;
  releaseDate: string | null;
  droppable: number;
  owned: number;
  completed: boolean;
}

type Filter = "all" | "progress" | "todo";

function norm(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Vitrine des boosters de set : recherche, filtres et progression du joueur sur chaque set. */
export function SetShop({ sets, balance, price }: { sets: ShopSet[]; balance: number; price: number }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const query = useDeferredValue(q);
  const affordable = balance >= price;

  const groups = useMemo(() => {
    const nq = norm(query.trim());
    const list = sets.filter((s) => {
      if (nq && !norm(`${s.name} ${s.serieName} ${s.id}`).includes(nq)) return false;
      if (filter === "progress") return s.owned > 0 && !s.completed;
      if (filter === "todo") return !s.completed;
      return true;
    });
    const map = new Map<string, { name: string; sets: ShopSet[] }>();
    for (const s of list) {
      const g = map.get(s.serieId) ?? { name: s.serieName, sets: [] };
      g.sets.push(s);
      map.set(s.serieId, g);
    }
    return [...map.entries()];
  }, [sets, query, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Tous" },
    { id: "progress", label: "Commencés" },
    { id: "todo", label: "À compléter" },
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid gap-3 sm:flex sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Chercher un set</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un set ou une série"
            className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
        <div className="pf-scroll-x -mx-4 flex gap-2 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filtrer">
          {filters.map((f) => (
            <button key={f.id} type="button" className="pf-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className="rounded-xl bg-surface p-6 text-center text-muted">Aucun set ne correspond.</p>}

      {groups.map(([id, g]) => (
        <section key={id} aria-labelledby={`shop-${id}`} className="grid min-w-0 gap-3">
          <h2 id={`shop-${id}`} className="font-display text-lg font-bold">
            {g.name}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {g.sets.map((s) => (
              <li key={s.id} className="min-w-0">
                <Link
                  href={`/boosters/sets/${s.id}`}
                  className="group grid gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-3 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent"
                >
                  <div className="relative mx-auto w-[78%] transition-transform group-hover:-rotate-2">
                    <BoosterPackArt label={s.name} logo={s.logo} cover={s.cover} coverQuality="low" palette={s.id} empty={!affordable} className="shadow-none" />
                    {s.completed && (
                      <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-lime text-bg" title="Set complété">
                        <CheckCircle2 aria-label="Set complété" className="size-4" />
                      </span>
                    )}
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={cn("font-mono", s.completed ? "text-lime" : "text-muted")}>
                        {s.owned}/{s.droppable}
                      </span>
                      <Jetons value={price} className={affordable ? "text-[#FFC93C]" : "text-muted"} />
                    </div>
                    <ProgressBar value={s.owned} max={s.droppable} label={`Complétion ${s.name}`} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
