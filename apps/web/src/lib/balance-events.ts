/** Diffusion locale du nouveau solde après une action, pour que l'en-tête réagisse sans attendre le serveur. */
const EVENT = "pf:balance";

export function emitBalance(balance: number) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { balance } }));
}

export function onBalance(cb: (e: { balance: number }) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<{ balance: number }>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
