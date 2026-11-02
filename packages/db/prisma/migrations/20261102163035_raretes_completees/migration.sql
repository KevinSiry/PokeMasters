-- AlterEnum
ALTER TYPE "LedgerReason" ADD VALUE 'rarity_bonus';

-- CreateTable
CREATE TABLE "SetRarityCompletion" (
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "bonus" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetRarityCompletion_pkey" PRIMARY KEY ("userId","setId","rarity")
);

-- AddForeignKey
ALTER TABLE "SetRarityCompletion" ADD CONSTRAINT "SetRarityCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetRarityCompletion" ADD CONSTRAINT "SetRarityCompletion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
