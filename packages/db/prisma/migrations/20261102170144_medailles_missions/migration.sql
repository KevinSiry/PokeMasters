-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerReason" ADD VALUE 'medal';
ALTER TYPE "LedgerReason" ADD VALUE 'guild_mission';

-- CreateTable
CREATE TABLE "UserMedal" (
    "userId" TEXT NOT NULL,
    "medalId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "reward" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMedal_pkey" PRIMARY KEY ("userId","medalId","level")
);

-- CreateTable
CREATE TABLE "GuildMissionClaim" (
    "userId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "reward" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMissionClaim_pkey" PRIMARY KEY ("userId","week","kind")
);

-- AddForeignKey
ALTER TABLE "UserMedal" ADD CONSTRAINT "UserMedal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMissionClaim" ADD CONSTRAINT "GuildMissionClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
