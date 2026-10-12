/**
 * Schémas Zod des réponses TCGdex (API REST v2), vérifiés sur l'API réelle le 2026-10-12.
 * Volontairement tolérants (`passthrough`, champs optionnels) : TCGdex ajoute des champs
 * régulièrement et beaucoup de cartes anciennes n'ont pas toutes les données.
 */
import { z } from "zod";

const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish();

export const serieSummarySchema = z
  .object({ id: z.string(), name: z.string(), logo: nullish(z.string()) })
  .passthrough();
export type SerieSummary = z.infer<typeof serieSummarySchema>;

const cardCountSchema = z
  .object({
    total: z.number().int().nonnegative().catch(0),
    official: z.number().int().nonnegative().catch(0),
    normal: nullish(z.number()),
    reverse: nullish(z.number()),
    holo: nullish(z.number()),
    firstEd: nullish(z.number()),
  })
  .passthrough();

export const setSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    logo: nullish(z.string()),
    symbol: nullish(z.string()),
    cardCount: cardCountSchema.partial().passthrough().optional(),
  })
  .passthrough();
export type SetSummary = z.infer<typeof setSummarySchema>;

export const cardSummarySchema = z
  .object({ id: z.string(), localId: z.union([z.string(), z.number()]).transform(String), name: z.string(), image: nullish(z.string()) })
  .passthrough();
export type CardSummary = z.infer<typeof cardSummarySchema>;

export const setDetailSchema = setSummarySchema.extend({
  releaseDate: nullish(z.string()),
  serie: z.object({ id: z.string(), name: z.string() }).passthrough(),
  cardCount: cardCountSchema,
  cards: z.array(cardSummarySchema).default([]),
});
export type SetDetail = z.infer<typeof setDetailSchema>;

// Certaines cartes anciennes ont des attaques sans nom (texte d'effet seul).
const attackSchema = z
  .object({
    name: z.string().nullish().transform((v) => v ?? ""),
    cost: nullish(z.array(z.string())),
    damage: nullish(z.union([z.string(), z.number()])),
    effect: nullish(z.string()),
  })
  .passthrough();

const abilitySchema = z
  .object({ name: z.string().nullish().transform((v) => v ?? ""), type: nullish(z.string()), effect: nullish(z.string()) })
  .passthrough();

const typeValueSchema = z
  .object({ type: z.string(), value: nullish(z.union([z.string(), z.number()])) })
  .passthrough();

const cardmarketSchema = z
  .object({ trend: nullish(z.number()), avg: nullish(z.number()), "trend-holo": nullish(z.number()), updated: nullish(z.string()) })
  .passthrough();

export const cardDetailSchema = z
  .object({
    id: z.string(),
    localId: z.union([z.string(), z.number()]).transform(String),
    name: z.string(),
    image: nullish(z.string()),
    category: z.string(),
    illustrator: nullish(z.string()),
    rarity: nullish(z.string()),
    hp: nullish(z.union([z.number(), z.string()])),
    types: nullish(z.array(z.string())),
    evolveFrom: nullish(z.string()),
    description: nullish(z.string()),
    stage: nullish(z.string()),
    effect: nullish(z.string()),
    trainerType: nullish(z.string()),
    energyType: nullish(z.string()),
    regulationMark: nullish(z.string()),
    dexId: nullish(z.array(z.number())),
    retreat: nullish(z.number()),
    attacks: nullish(z.array(attackSchema)),
    abilities: nullish(z.array(abilitySchema)),
    weaknesses: nullish(z.array(typeValueSchema)),
    resistances: nullish(z.array(typeValueSchema)),
    variants: nullish(
      z
        .object({
          normal: nullish(z.boolean()),
          reverse: nullish(z.boolean()),
          holo: nullish(z.boolean()),
          firstEdition: nullish(z.boolean()),
        })
        .passthrough(),
    ),
    set: z.object({ id: z.string(), name: nullish(z.string()) }).passthrough(),
    pricing: nullish(z.object({ cardmarket: nullish(cardmarketSchema) }).passthrough()),
  })
  .passthrough();
export type CardDetail = z.infer<typeof cardDetailSchema>;
