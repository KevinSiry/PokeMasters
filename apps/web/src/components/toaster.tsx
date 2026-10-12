"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Jetons } from "@/components/jetons";
import { cn } from "@/lib/utils";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: "success" | "error" | "info";
  jetons?: number;
  /** Lien d'action (« Voir », « Rejoindre »…). */
  action?: { label: string; href: string };
  /** Durée d'affichage en ms (par défaut selon le ton). */
  duration?: number;
}

const EVENT = "pf:toast";

/** Affiche une notification éphémère (en bas sur mobile, en haut à droite sur ordinateur). */
export function toast(t: ToastInput) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export function Toaster() {
  const [items, setItems] = useState<(ToastInput & { id: number })[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = { ...(e as CustomEvent<ToastInput>).detail, id: Date.now() + Math.random() };
      setItems((all) => [...all.slice(-2), t]);
      window.setTimeout(() => setItems((all) => all.filter((x) => x.id !== t.id)), t.duration ?? (t.tone === "error" || t.action ? 6000 : 3800));
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] grid justify-items-center gap-2 px-4 sm:inset-x-auto sm:top-20 sm:right-6 sm:bottom-auto sm:justify-items-end"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICONS[t.tone ?? "success"];
          return (
            <motion.div
              key={t.id}
              layout
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 pr-4 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)] backdrop-blur"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", t.tone === "error" ? "text-danger" : t.tone === "info" ? "text-accent" : "text-lime")} />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="text-xs text-muted">{t.description}</p>}
              </div>
              {t.jetons !== undefined && <Jetons value={t.jetons} signed className="text-sm text-[#FFC93C]" />}
              {t.action && (
                <Link
                  href={t.action.href}
                  onClick={() => setItems((all) => all.filter((x) => x.id !== t.id))}
                  className="shrink-0 self-center rounded-full bg-gradient-to-r from-accent-strong to-coral-strong px-3 py-1.5 text-xs font-bold text-white"
                >
                  {t.action.label}
                </Link>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
