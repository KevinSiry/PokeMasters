import { boosterLayoutFor, boosterSize } from "@pokeflex/config";
import type { WeeklySetInfo } from "@pokeflex/server";
import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { BoosterPackArt } from "@/components/booster/booster-pack";
import { Jetons } from "@/components/jetons";

const until = new Intl.DateTimeFormat("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Encart du set de la semaine : booster à prix réduit jusqu'au lundi suivant. */
export function WeeklySetBanner({ weekly, cover }: { weekly: WeeklySetInfo; cover?: string | null }) {
  const off = Math.round((1 - weekly.price / weekly.fullPrice) * 100);
  return (
    <Link
      href={`/boosters/sets/${weekly.setId}`}
      data-weekly-set={weekly.setId}
      className="group relative grid grid-cols-[auto_1fr] items-center gap-4 overflow-hidden rounded-[calc(var(--radius-card)*1.4)] border border-[#FFC93C]/60 bg-[radial-gradient(120%_140%_at_0%_0%,rgb(255_201_60/0.2),transparent_60%),var(--color-surface)] p-4 transition-colors hover:border-[#FFC93C] sm:gap-5 sm:p-6"
    >
      <div className="w-20 transition-transform duration-300 group-hover:-rotate-3 sm:w-28">
        <BoosterPackArt label={weekly.name} logo={weekly.logo} cover={cover ?? null} coverQuality="low" palette={weekly.setId} count={boosterSize(boosterLayoutFor(weekly.serieId))} className="shadow-none" />
      </div>
      <div className="grid min-w-0 gap-1.5">
        <p className="flex flex-wrap items-center gap-2 font-mono text-xs tracking-[0.16em] text-[#FFC93C] uppercase">
          Set de la semaine
          <span className="rounded-full bg-[#FFC93C] px-2 py-0.5 tracking-normal text-bg">−{off} %</span>
        </p>
        <p className="truncate font-display text-lg font-bold sm:text-xl">{weekly.name}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <Jetons value={weekly.price} className="text-[#FFC93C]" />
          <span className="text-muted line-through">
            <Jetons value={weekly.fullPrice} className="text-muted" />
          </span>
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock aria-hidden="true" className="size-3.5" />
          Jusqu&apos;à {until.format(new Date(weekly.endsAt))}
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
          Ouvrir ce booster
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
