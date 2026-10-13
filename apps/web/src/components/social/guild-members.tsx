"use client";

import { Crown, MoreHorizontal, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { manageGuildMemberAction } from "@/app/actions/social";
import { PlayerAvatar } from "@/components/player-avatar";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getSocket, useSocketEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";

type Role = "owner" | "officer" | "member";
type Action = "promote" | "demote" | "kick" | "transfer";

interface Member {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
  role: Role;
  distinctCards: number;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Chef",
  officer: "Officier",
  member: "Membre",
};

function MemberMenu({ m, myRole, onAct }: { m: Member; myRole: Role; onAct: (a: Action) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const actions: [Action, string][] = [];
  if (myRole === "owner") {
    actions.push(m.role === "officer" ? ["demote", "Rétrograder en membre"] : ["promote", "Nommer officier"]);
    actions.push(["transfer", "Faire chef de guilde"]);
    actions.push(["kick", "Exclure"]);
  } else if (myRole === "officer" && m.role === "member") {
    actions.push(["kick", "Exclure"]);
  }
  if (actions.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Gérer ${m.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-8 place-items-center rounded-full text-muted hover:bg-elev hover:text-fg"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      <div
        role="menu"
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-1 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]"
      >
        {actions.map(([a, label]) => (
          <button
            key={a}
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onAct(a);
            }}
            className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-elev", a === "kick" && "text-coral")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Membres de la guilde, chef et officiers d'abord ; gestion selon le rôle du joueur. */
export function GuildMembers({ guildId, members, me, myRole }: { guildId: string; members: Member[]; me: string | null; myRole: Role | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<{
    m: Member;
    a: "kick" | "transfer";
  } | null>(null);

  // Arrivées, départs et changements de rôle annoncés par les autres membres.
  useSocketEvent("guild:members", () => router.refresh());

  function act(m: Member, a: Action, confirmed = false) {
    if ((a === "kick" || a === "transfer") && !confirmed) {
      setConfirm({ m, a });
      return;
    }
    setConfirm(null);
    start(async () => {
      const res = await manageGuildMemberAction(m.id, a);
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        return;
      }
      getSocket().emit("guild:sync", { userId: m.id, guildId });
      toast({
        title: {
          kick: `${m.name} a été exclu`,
          promote: `${m.name} est officier`,
          demote: `${m.name} est membre`,
          transfer: `${m.name} est le nouveau chef`,
        }[a],
        tone: "info",
      });
      router.refresh();
    });
  }

  return (
    <section className="grid content-start gap-3" aria-labelledby="membres">
      <h2 id="membres" className="font-display text-lg font-bold">
        Membres
      </h2>
      <ul className="grid gap-1.5">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
            <Link href={`/joueurs/${m.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
              <PlayerAvatar name={m.name} image={m.image} size="sm" />
              <span className="grid min-w-0">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {m.name}
                  {m.id === me && <span className="text-xs font-normal text-muted">(toi)</span>}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  {m.role === "owner" && <Crown aria-hidden="true" className="size-3.5 text-[#FFC93C]" />}
                  {m.role === "officer" && <ShieldCheck aria-hidden="true" className="size-3.5 text-accent" />}
                  {ROLE_LABEL[m.role]} · {m.distinctCards.toLocaleString("fr-FR")} cartes
                </span>
              </span>
            </Link>
            {myRole && m.id !== me && <MemberMenu m={m} myRole={myRole} onAct={(a) => act(m, a)} />}
          </li>
        ))}
      </ul>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.a === "kick" ? `Exclure ${confirm.m.name} ?` : `Confier la guilde à ${confirm?.m.name ?? ""} ?`}
        description={confirm?.a === "kick" ? "Il pourra revenir plus tard s'il reste de la place." : "Tu deviendras officier."}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Annuler
          </Button>
          <Button disabled={pending} onClick={() => confirm && act(confirm.m, confirm.a, true)}>
            {confirm?.a === "kick" ? "Exclure" : "Confier"}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
