"use client";

import { Ban, Check, Flag, Loader2, MessageCircle, MoreHorizontal, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { blockUserAction, removeFriendAction, respondFriendRequestAction, sendFriendRequestAction, unblockUserAction } from "@/app/actions/social";
import { ReportDialog } from "@/components/social/report-dialog";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getSocket } from "@/lib/realtime";

type Relation = "none" | "friends" | "request_sent" | "request_received" | "blocked" | "blocked_by" | "self";

interface Target {
  id: string;
  name: string;
  handle: string;
}

/** Prévient l'autre joueur en direct (le serveur vérifie la relation en base). */
export function pingSocial(to: string) {
  getSocket().emit("social:ping", { to });
}

/** Boutons d'un profil public : ami, message, et menu (retirer, bloquer, signaler). */
export function ProfileActions({ target, relation }: { target: Target; relation: Relation }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [report, setReport] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function act<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, done: (data: T) => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        return;
      }
      done(res.data);
      router.refresh();
    });
  }

  const add = () =>
    act(
      () => sendFriendRequestAction(target.handle),
      (r) => {
        pingSocial(target.id);
        toast(r.status === "accepted" ? { title: `${target.name} et toi êtes amis\u00a0!` } : { title: "Demande d'ami envoyée", tone: "info" });
      },
    );
  const respond = (accept: boolean) =>
    act(
      () => respondFriendRequestAction(target.id, accept),
      () => {
        if (accept) {
          pingSocial(target.id);
          toast({ title: `${target.name} et toi êtes amis\u00a0!` });
        }
      },
    );

  const blocked = relation === "blocked" || relation === "blocked_by";
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-elev [&_svg]:size-4 [&_svg]:text-muted";

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*:first-child]:max-sm:flex-1">
      {relation === "none" && (
        <Button size="sm" onClick={add} disabled={pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserPlus aria-hidden="true" />}
          Ajouter en ami
        </Button>
      )}
      {relation === "request_sent" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            act(
              () => removeFriendAction(target.id),
              () => toast({ title: "Demande annulée", tone: "info" }),
            )
          }
          disabled={pending}
        >
          <UserCheck aria-hidden="true" />
          Demande envoyée
        </Button>
      )}
      {relation === "request_received" && (
        <>
          <Button size="sm" onClick={() => respond(true)} disabled={pending}>
            <Check aria-hidden="true" />
            Accepter
          </Button>
          <Button size="sm" variant="secondary" onClick={() => respond(false)} disabled={pending}>
            <X aria-hidden="true" />
            Refuser
          </Button>
        </>
      )}
      {relation === "friends" && (
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-lime/40 bg-lime/10 px-3 text-sm font-semibold text-lime">
          <UserCheck aria-hidden="true" className="size-4" />
          Amis
        </span>
      )}
      {relation === "blocked" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            act(
              () => unblockUserAction(target.id),
              () => toast({ title: `${target.name} est débloqué`, tone: "info" }),
            )
          }
          disabled={pending}
        >
          <Ban aria-hidden="true" />
          Débloquer
        </Button>
      )}
      {!blocked && (
        <>
          <Button asChild size="sm" variant="secondary" className="max-sm:w-11 max-sm:px-0">
            <Link href={`/messages/${target.handle}`} aria-label={`Écrire à ${target.name}`}>
              <MessageCircle aria-hidden="true" />
              <span className="max-sm:hidden">Message</span>
            </Link>
          </Button>
        </>
      )}
      <div ref={menuRef} className="relative">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Plus d'actions"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="w-11 px-0 sm:w-9"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
        <div
          role="menu"
          hidden={!menu}
          className="absolute top-full right-0 z-30 mt-2 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]"
        >
          {relation === "friends" && (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                setMenu(false);
                act(
                  () => removeFriendAction(target.id),
                  () =>
                    toast({
                      title: `${target.name} retiré de tes amis`,
                      tone: "info",
                    }),
                );
              }}
            >
              <UserMinus aria-hidden="true" />
              Retirer des amis
            </button>
          )}
          {relation !== "blocked" && (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                setMenu(false);
                setConfirmBlock(true);
              }}
            >
              <Ban aria-hidden="true" />
              Bloquer
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setMenu(false);
              setReport(true);
            }}
          >
            <Flag aria-hidden="true" />
            Signaler
          </button>
        </div>
      </div>

      <Dialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`Bloquer ${target.name} ?`}
        description="Vous ne pourrez plus vous écrire, ni vous ajouter en ami. Il n'en est pas averti."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmBlock(false)}>
            Annuler
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              act(
                () => blockUserAction(target.id),
                () => {
                  setConfirmBlock(false);
                  toast({ title: `${target.name} est bloqué`, tone: "info" });
                },
              )
            }
          >
            Bloquer
          </Button>
        </div>
      </Dialog>
      <ReportDialog open={report} onClose={() => setReport(false)} target={target} />
    </div>
  );
}
