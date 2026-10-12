-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('fr', 'en');

-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('pokemon', 'trainer', 'energy');

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "lang" "Lang" NOT NULL DEFAULT 'fr',
    "firstReleaseDate" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Set" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "logo" TEXT,
    "symbol" TEXT,
    "releaseDate" TIMESTAMP(3),
    "cardCountOfficial" INTEGER NOT NULL,
    "cardCountTotal" INTEGER NOT NULL,
    "lang" "Lang" NOT NULL DEFAULT 'fr',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "sortKey" INTEGER NOT NULL DEFAULT 0,
    "setId" TEXT NOT NULL,
    "nameFr" TEXT,
    "nameEn" TEXT,
    "name" TEXT NOT NULL,
    "lang" "Lang" NOT NULL,
    "image" TEXT,
    "imageLang" "Lang",
    "category" "CardCategory" NOT NULL,
    "rarityRaw" TEXT,
    "tier" "Tier" NOT NULL,
    "tierReason" TEXT NOT NULL,
    "hp" INTEGER,
    "types" TEXT[],
    "typesRaw" TEXT[],
    "stage" TEXT,
    "evolveFrom" TEXT,
    "dexIds" INTEGER[],
    "illustrator" TEXT,
    "retreat" INTEGER,
    "description" TEXT,
    "effect" TEXT,
    "trainerType" TEXT,
    "energyType" TEXT,
    "regulationMark" TEXT,
    "attacks" JSONB NOT NULL DEFAULT '[]',
    "abilities" JSONB NOT NULL DEFAULT '[]',
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "resistances" JSONB NOT NULL DEFAULT '[]',
    "variants" JSONB NOT NULL DEFAULT '{}',
    "priceEurTrend" DECIMAL(10,2),
    "priceUpdatedAt" TIMESTAMP(3),
    "droppable" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "cursor" JSONB,
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Set_serieId_releaseDate_idx" ON "Set"("serieId", "releaseDate");

-- CreateIndex
CREATE INDEX "Set_releaseDate_idx" ON "Set"("releaseDate");

-- CreateIndex
CREATE INDEX "Card_setId_sortKey_idx" ON "Card"("setId", "sortKey");

-- CreateIndex
CREATE INDEX "Card_tier_droppable_idx" ON "Card"("tier", "droppable");

-- CreateIndex
CREATE INDEX "Card_illustrator_idx" ON "Card"("illustrator");

-- CreateIndex
CREATE INDEX "Card_category_idx" ON "Card"("category");

-- CreateIndex
CREATE INDEX "SyncRun_kind_startedAt_idx" ON "SyncRun"("kind", "startedAt");

-- AddForeignKey
ALTER TABLE "Set" ADD CONSTRAINT "Set_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recherche tolérante FR/EN (« dracaufeu », « charizard », « electhor ») sans moteur externe.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() n'est pas IMMUTABLE : on l'enveloppe pour pouvoir l'indexer.
CREATE OR REPLACE FUNCTION pf_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE INDEX "Card_search_trgm_idx" ON "Card"
  USING GIN (lower(pf_unaccent(coalesce("nameFr", '') || ' ' || coalesce("nameEn", ''))) gin_trgm_ops);
