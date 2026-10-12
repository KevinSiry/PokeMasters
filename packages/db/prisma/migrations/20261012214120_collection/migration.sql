-- CreateEnum
CREATE TYPE "Finish" AS ENUM ('normal', 'reverse', 'holo', 'firstEdition');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('owned', 'listed', 'staked');

-- CreateTable
CREATE TABLE "CardCopy" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "finish" "Finish" NOT NULL DEFAULT 'normal',
    "status" "CopyStatus" NOT NULL DEFAULT 'owned',
    "obtainedVia" TEXT NOT NULL,
    "openingId" TEXT,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoosterOpening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "setId" TEXT,
    "cardIds" TEXT[],
    "tiers" "Tier"[],
    "finishes" "Finish"[],
    "cost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoosterOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardCopy_ownerId_cardId_idx" ON "CardCopy"("ownerId", "cardId");

-- CreateIndex
CREATE INDEX "CardCopy_ownerId_obtainedAt_idx" ON "CardCopy"("ownerId", "obtainedAt");

-- CreateIndex
CREATE INDEX "CardCopy_cardId_idx" ON "CardCopy"("cardId");

-- CreateIndex
CREATE INDEX "BoosterOpening_userId_createdAt_idx" ON "BoosterOpening"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CardCopy" ADD CONSTRAINT "CardCopy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCopy" ADD CONSTRAINT "CardCopy_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoosterOpening" ADD CONSTRAINT "BoosterOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
