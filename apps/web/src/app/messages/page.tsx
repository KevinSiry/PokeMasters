import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false },
};

export default function MessagesPage() {
  return (
    <section className="hidden place-items-center rounded-[calc(var(--radius-card)*1.2)] border border-dashed border-line p-8 text-center md:grid">
      <div className="grid justify-items-center gap-3">
        <MessageCircle aria-hidden="true" className="size-10 text-muted" />
        <p className="font-display text-lg font-bold">Tes messages</p>
        <p className="max-w-[40ch] text-sm text-muted">
          Choisis une conversation, ou écris à un dresseur depuis son profil ou ta liste d&apos;
          <Link href="/amis" className="text-accent hover:underline">
            amis
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
