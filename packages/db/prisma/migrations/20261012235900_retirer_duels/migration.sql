-- Retrait des duels quiz (décision de Kevin, 2026-10-12).
-- Les cartes encore misées reviennent à leur propriétaire et les quêtes « Gagner 1 duel »
-- non réclamées disparaissent. Les lignes de registre duel_* restent : l'historique des Jetons est intact.
UPDATE "CardCopy" SET status = 'owned' WHERE status = 'staked';
DELETE FROM "DailyQuest" WHERE kind = 'win_duel' AND "claimedAt" IS NULL;

-- AlterEnum
BEGIN;
CREATE TYPE "CopyStatus_new" AS ENUM ('owned', 'listed');
ALTER TABLE "public"."CardCopy" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CardCopy" ALTER COLUMN "status" TYPE "CopyStatus_new" USING ("status"::text::"CopyStatus_new");
ALTER TYPE "CopyStatus" RENAME TO "CopyStatus_old";
ALTER TYPE "CopyStatus_new" RENAME TO "CopyStatus";
DROP TYPE "public"."CopyStatus_old";
ALTER TABLE "CardCopy" ALTER COLUMN "status" SET DEFAULT 'owned';
COMMIT;

-- DropForeignKey
ALTER TABLE "Duel" DROP CONSTRAINT "Duel_playerAId_fkey";

-- DropForeignKey
ALTER TABLE "Duel" DROP CONSTRAINT "Duel_playerBId_fkey";

-- DropForeignKey
ALTER TABLE "DuelAnswer" DROP CONSTRAINT "DuelAnswer_duelId_fkey";

-- DropForeignKey
ALTER TABLE "DuelStake" DROP CONSTRAINT "DuelStake_copyId_fkey";

-- DropForeignKey
ALTER TABLE "DuelStake" DROP CONSTRAINT "DuelStake_duelId_fkey";

-- DropForeignKey
ALTER TABLE "DuelStake" DROP CONSTRAINT "DuelStake_userId_fkey";

-- DropTable
DROP TABLE "Duel";

-- DropTable
DROP TABLE "DuelAnswer";

-- DropTable
DROP TABLE "DuelStake";

-- DropEnum
DROP TYPE "DuelKind";

-- DropEnum
DROP TYPE "DuelStatus";

