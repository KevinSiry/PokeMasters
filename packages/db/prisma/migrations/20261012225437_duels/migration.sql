-- CreateEnum
CREATE TYPE "DuelKind" AS ENUM ('challenge', 'quick', 'training');

-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('pending', 'ready', 'active', 'finished', 'cancelled', 'declined', 'expired');

-- CreateTable
CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "kind" "DuelKind" NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'pending',
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT,
    "seed" TEXT,
    "questions" JSONB,
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT,
    "forfeitBy" TEXT,
    "rewardA" INTEGER,
    "rewardB" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelStake" (
    "id" TEXT NOT NULL,
    "duelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "copyId" TEXT,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "DuelStake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelAnswer" (
    "duelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qIndex" INTEGER NOT NULL,
    "choice" INTEGER,
    "correct" BOOLEAN NOT NULL,
    "answeredMs" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "DuelAnswer_pkey" PRIMARY KEY ("duelId","userId","qIndex")
);

-- CreateIndex
CREATE INDEX "Duel_playerAId_createdAt_idx" ON "Duel"("playerAId", "createdAt");

-- CreateIndex
CREATE INDEX "Duel_playerBId_createdAt_idx" ON "Duel"("playerBId", "createdAt");

-- CreateIndex
CREATE INDEX "Duel_status_expiresAt_idx" ON "Duel"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "DuelStake_duelId_idx" ON "DuelStake"("duelId");

-- CreateIndex
CREATE INDEX "DuelStake_copyId_idx" ON "DuelStake"("copyId");

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelStake" ADD CONSTRAINT "DuelStake_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "Duel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelStake" ADD CONSTRAINT "DuelStake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelStake" ADD CONSTRAINT "DuelStake_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "CardCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelAnswer" ADD CONSTRAINT "DuelAnswer_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "Duel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garde-fous : scores positifs, pas de duel contre soi-même, entraînement sans adversaire.
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_scores_non_negative" CHECK ("scoreA" >= 0 AND "scoreB" >= 0);
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_distinct_players" CHECK ("playerBId" IS NULL OR "playerBId" <> "playerAId");
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_training_solo" CHECK (("kind" = 'training') = ("playerBId" IS NULL));
ALTER TABLE "DuelAnswer" ADD CONSTRAINT "DuelAnswer_points_non_negative" CHECK ("points" >= 0 AND "answeredMs" >= 0);
