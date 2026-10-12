"use client";

import { Flag, Loader2, SendHorizonal, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlayerAvatar } from "@/components/player-avatar";
import { ReportDialog } from "@/components/social/report-dialog";
import { toast } from "@/components/toaster";
import { frenchSpacing } from "@/lib/format";
import { useConnection } from "@/lib/realtime";
import { cn } from "@/lib/utils";

export interface ChatAuthor {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
}

export interface ChatItem {
  id: string;
  body: string;
  createdAt: string;
  author: ChatAuthor;
  readAt?: string | null;
}

const day = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});
const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const dayKey = (iso: string) => day.format(new Date(iso));

function dayLabel(iso: string) {
  const d = dayKey(iso);
  if (d === dayKey(new Date().toISOString())) return "Aujourd'hui";
  if (d === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return "Hier";
  return d;
}

/**
 * Fil de discussion (messages privés et chat de guilde) : regroupement par jour et par auteur,
 * défilement automatique, Entrée pour envoyer, signalement d'un message.
 */
export function ChatPanel({
  me,
  messages,
  onSend,
  maxLength,
  placeholder,
  showAuthors,
  emptyState,
  onLoadOlder,
  readReceipts,
  disabled,
  contextPrefix,
  className,
}: {
  me: string;
  messages: ChatItem[];
  onSend: (body: string) => Promise<{ ok: boolean; error?: string }>;
  maxLength: number;
  placeholder: string;
  /** Afficher nom et avatar des auteurs (chat de groupe). */
  showAuthors?: boolean;
  emptyState: React.ReactNode;
  onLoadOlder?: () => Promise<boolean>;
  readReceipts?: boolean;
  /** Message affiché à la place de la zone de saisie (joueur bloqué…). */
  disabled?: string;
  /** Préfixe du contexte de signalement ("dm" ou "guild"). */
  contextPrefix: string;
  className?: string;
}) {
  const connected = useConnection();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(Boolean(onLoadOlder));
  const [report, setReport] = useState<{
    author: ChatAuthor;
    id: string;
  } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = messages.at(-1)?.id;

  // Reste collé en bas quand un message arrive, sauf si le joueur remonte lire l'historique.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, messages.length]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    stick.current = true;
    const res = await onSend(body);
    setSending(false);
    if (res.ok) setDraft("");
    else toast({ title: res.error ?? "Message non envoyé.", tone: "error" });
  }

  async function older() {
    if (!onLoadOlder || loadingOlder) return;
    const el = scroller.current;
    const before = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    stick.current = false;
    const more = await onLoadOlder();
    setLoadingOlder(false);
    setHasOlder(more);
    // Garde la position de lecture après l'ajout des anciens messages.
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  }

  const lastMineRead = readReceipts ? [...messages].reverse().find((m) => m.author.id === me) : undefined;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {hasOlder && messages.length >= 40 && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={older}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-fg"
              disabled={loadingOlder}
            >
              {loadingOlder ? "Chargement…" : "Messages précédents"}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-muted">{emptyState}</div>
        ) : (
          <ol className="grid gap-0.5">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const grouped = !newDay && prev?.author.id === m.author.id && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
              const mine = m.author.id === me;
              return (
                <li key={m.id} className="grid">
                  {newDay && (
                    <p className="my-3 text-center text-[11px] font-semibold tracking-wide text-muted uppercase first:mt-0">{dayLabel(m.createdAt)}</p>
                  )}
                  <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row", !grouped && "mt-2")}>
                    {showAuthors && !mine && (
                      <span className="w-8 shrink-0">
                        {!grouped && (
                          <Link href={`/joueurs/${m.author.handle}`} aria-label={`Profil de ${m.author.name}`}>
                            <PlayerAvatar name={m.author.name} image={m.author.image} size="sm" />
                          </Link>
                        )}
                      </span>
                    )}
                    <div className={cn("grid max-w-[80%] gap-0.5", mine ? "justify-items-end" : "justify-items-start")}>
                      {showAuthors && !mine && !grouped && <span className="px-1 text-xs font-semibold text-muted">{m.author.name}</span>}
                      <p
                        className={cn(
                          "rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
                          mine ? "rounded-br-md bg-gradient-to-br from-accent-strong to-[#6B3FD6] text-fg" : "rounded-bl-md bg-elev",
                        )}
                      >
                        {frenchSpacing(m.body)}
                      </p>
                    </div>
                    <span className="mb-1 shrink-0 font-mono text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
                      {time.format(new Date(m.createdAt))}
                    </span>
                    {!mine && (
                      <button
                        type="button"
                        onClick={() => setReport({ author: m.author, id: m.id })}
                        aria-label={`Signaler le message de ${m.author.name}`}
                        className="mb-0.5 grid size-6 shrink-0 place-items-center rounded-full text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-coral focus-visible:opacity-100"
                      >
                        <Flag aria-hidden="true" className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {lastMineRead?.id === m.id && m.readAt && <span className="mt-0.5 pr-1 text-right text-[10px] text-muted">Vu</span>}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {disabled ? (
        <p className="border-t border-line px-4 py-4 text-center text-sm text-muted">{disabled}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="grid gap-1 border-t border-line p-3"
        >
          {!connected && (
            <p className="flex items-center gap-1.5 text-xs text-coral">
              <WifiOff aria-hidden="true" className="size-3.5" />
              Reconnexion au chat…
            </p>
          )}
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ton message</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={maxLength}
                placeholder={placeholder}
                className="field-sizing-content max-h-36 min-h-11 w-full resize-none rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={!draft.trim() || sending || !connected}
              aria-label="Envoyer"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-r from-accent-strong to-coral-strong text-fg transition-transform active:scale-95 disabled:opacity-40"
            >
              {sending ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <SendHorizonal aria-hidden="true" className="size-5" />}
            </button>
          </div>
          {draft.length > maxLength * 0.8 && (
            <span className="text-right font-mono text-[10px] text-muted">
              {draft.length}/{maxLength}
            </span>
          )}
        </form>
      )}
      {report && <ReportDialog open onClose={() => setReport(null)} target={report.author} context={`${contextPrefix}:${report.id}`} />}
    </div>
  );
}
