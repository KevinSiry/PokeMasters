/**
 * Client HTTP TCGdex « poli » : concurrence limitée, retry exponentiel avec gigue
 * sur les erreurs réseau, 429 et 5xx, et 404 transformé en `null`.
 */
import type { z } from "zod";
import {
  cardDetailSchema,
  cardSummarySchema,
  serieSummarySchema,
  setDetailSchema,
  setSummarySchema,
} from "./schemas";

export type TcgdexLang = "fr" | "en";

export interface TcgdexClientOptions {
  baseUrl?: string;
  concurrency?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { url: string; attempt: number; reason: string }) => void;
}

export class TcgdexError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TcgdexError";
  }
}

/** Sémaphore minimaliste : au plus `max` tâches en parallèle. */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const release = () => {
    active--;
    queue.shift()?.();
  };
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createTcgdexClient(opts: TcgdexClientOptions = {}) {
  const baseUrl = (opts.baseUrl ?? "https://api.tcgdex.net/v2").replace(/\/+$/, "");
  const maxRetries = opts.maxRetries ?? 5;
  const baseDelay = opts.retryBaseDelayMs ?? 500;
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const limit = createLimiter(opts.concurrency ?? 4);

  async function getJson(path: string): Promise<unknown | null> {
    const url = `${baseUrl}${path}`;
    for (let attempt = 0; ; attempt++) {
      let reason: string;
      try {
        const res = await limit(() =>
          doFetch(url, { headers: { accept: "application/json", "user-agent": "PokeFlex fan game (catalog sync)" } }),
        );
        if (res.status === 404) return null;
        if (res.ok) {
          const text = await res.text();
          // TCGdex répond parfois 200 avec un corps vide pour une ressource absente.
          if (!text.trim()) return null;
          return JSON.parse(text) as unknown;
        }
        if (res.status !== 429 && res.status < 500) {
          throw new TcgdexError(`TCGdex ${res.status} sur ${url}`, url, res.status);
        }
        reason = `HTTP ${res.status}`;
      } catch (err) {
        if (err instanceof TcgdexError) throw err;
        reason = err instanceof Error ? err.message : String(err);
      }
      if (attempt >= maxRetries) throw new TcgdexError(`TCGdex injoignable (${reason}) sur ${url}`, url);
      opts.onRetry?.({ url, attempt: attempt + 1, reason });
      const delay = baseDelay * 2 ** attempt;
      await sleep(delay + Math.floor(Math.random() * (delay / 2)));
    }
  }

  async function get<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S> | null> {
    const json = await getJson(path);
    if (json === null) return null;
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new TcgdexError(`Réponse inattendue sur ${path} : ${parsed.error.issues[0] ? `${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}` : "invalide"}`, path);
    }
    return parsed.data;
  }

  const list = <S extends z.ZodTypeAny>(path: string, item: S) =>
    get(path, (item as z.ZodTypeAny).array()).then((r) => (r ?? []) as z.infer<S>[]);

  return {
    series: (lang: TcgdexLang) => list(`/${lang}/series`, serieSummarySchema),
    sets: (lang: TcgdexLang) => list(`/${lang}/sets`, setSummarySchema),
    cards: (lang: TcgdexLang) => list(`/${lang}/cards`, cardSummarySchema),
    set: (lang: TcgdexLang, id: string) => get(`/${lang}/sets/${encodeURIComponent(id)}`, setDetailSchema),
    card: (lang: TcgdexLang, id: string) => get(`/${lang}/cards/${encodeURIComponent(id)}`, cardDetailSchema),
  };
}

export type TcgdexClient = ReturnType<typeof createTcgdexClient>;
