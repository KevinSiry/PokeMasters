-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('seed', 'admin', 'recycle', 'set_booster', 'set_bonus', 'quest', 'duel_win', 'duel_draw', 'duel_loss', 'market_fee', 'market_sale', 'market_purchase', 'bid_hold', 'bid_release', 'guild_create');

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetCompletion" (
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "bonus" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetCompletion_pkey" PRIMARY KEY ("userId","setId")
);

-- CreateTable
CREATE TABLE "DailyQuest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "reward" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "DailyQuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuest_userId_day_kind_key" ON "DailyQuest"("userId", "day", "kind");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetCompletion" ADD CONSTRAINT "SetCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetCompletion" ADD CONSTRAINT "SetCompletion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyQuest" ADD CONSTRAINT "DailyQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants : un solde ne passe jamais sous zéro, une quête ne dépasse pas sa cible.
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_balanceAfter_non_negative" CHECK ("balanceAfter" >= 0);
ALTER TABLE "DailyQuest" ADD CONSTRAINT "DailyQuest_progress_range" CHECK ("progress" >= 0 AND "progress" <= "target");
