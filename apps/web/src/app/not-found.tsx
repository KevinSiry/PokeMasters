import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="grid justify-items-center gap-5 py-24 text-center">
      <p className="font-display text-6xl font-bold text-prism">404</p>
      <h1 className="font-display text-xl font-bold">Cette carte n&apos;existe pas</h1>
      <p className="max-w-[44ch] text-muted">La page demandée est introuvable. Elle a peut-être changé d&apos;adresse.</p>
      <Button asChild>
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </section>
  );
}
