import { MEDAL_LEVEL_LABELS_FR } from "@pokeflex/config";
import type { MedalView } from "@pokeflex/server";
import { Medal } from "lucide-react";
import { Jetons } from "@/components/jetons";
import { cn } from "@/lib/utils";

const LEVEL_KEYS = ["bronze", "silver", "gold"] as const;

/** Couleur du médaillon selon le palier obtenu (aucun, bronze, argent, or). */
const RING = ["border-line text-muted", "border-[#D08A4F] text-[#E2A26A]", "border-[#C9D3E0] text-[#DCE4EE]", "border-[#FFC93C] text-[#FFC93C]"];
const TEXT = ["text-muted", "text-[#E2A26A]", "text-[#DCE4EE]", "text-[#FFC93C]"];
const GLOW = ["", "bg-[#D08A4F]/10", "bg-[#C9D3E0]/10", "bg-[#FFC93C]/12 shadow-[0_0_24px_-6px_#FFC93C]"];

/** Médailles d'un joueur : palier atteint, progression vers le suivant. */
export function MedalGrid({ medals, mine, fresh = [] }: { medals: MedalView[]; mine: boolean; fresh?: string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {medals.map((m) => {
        const prev = m.level > 0 ? m.thresholds[m.level - 1]! : 0;
        const pct = m.next ? Math.min(100, ((m.value - prev) / Math.max(1, m.next.target - prev)) * 100) : 100;
        const levelLabel = m.level > 0 ? MEDAL_LEVEL_LABELS_FR[LEVEL_KEYS[m.level - 1]!] : null;
        return (
          <li
            key={m.id}
            data-medal={m.id}
            data-level={m.level}
            className={cn("grid min-w-0 grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-line p-3", m.level === 0 && "opacity-75")}
          >
            <span aria-hidden="true" className={cn("relative grid size-11 place-items-center rounded-full border-2", RING[m.level], GLOW[m.level])}>
              <Medal className="size-5" />
              {fresh.includes(m.id) && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-coral" />}
            </span>
            <div className="grid min-w-0 gap-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                <span className="truncate">{m.label}</span>
                <span className={cn("font-mono text-[11px]", TEXT[m.level])}>
                  {levelLabel ?? "À débloquer"}
                </span>
              </p>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-elev"
                role="progressbar"
                aria-valuemin={prev}
                aria-valuemax={m.next?.target ?? m.value}
                aria-valuenow={m.value}
                aria-label={`${m.label} : ${m.value} ${m.unit}`}
              >
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-coral" style={{ width: `${pct}%` }} />
              </div>
              <p className="truncate text-[11px] text-muted">
                {m.next ? (
                  <>
                    {m.value.toLocaleString("fr-FR")}/{m.next.target.toLocaleString("fr-FR")} {m.unit}
                    {mine && (
                      <>
                        {" · "}
                        <Jetons value={m.next.reward} className="text-[11px]" />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {m.value.toLocaleString("fr-FR")} {m.unit} · paliers au complet
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
