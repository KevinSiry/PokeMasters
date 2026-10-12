"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cancelListingAction } from "@/app/marche/actions";
import { toast } from "@/components/toaster";

export function CancelListing({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelListingAction(id);
          if (!res.ok) return toast({ title: "Retrait impossible", description: res.error, tone: "error" });
          toast({ title: "Annonce retirée", description: "La carte est de retour dans ta collection.", tone: "info" });
          router.refresh();
        })
      }
      className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-line px-3 text-xs font-semibold text-muted hover:border-coral hover:text-fg disabled:opacity-50"
    >
      <X aria-hidden="true" className="size-3.5" />
      Retirer
    </button>
  );
}
