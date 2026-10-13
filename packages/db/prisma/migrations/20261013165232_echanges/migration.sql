-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'countered', 'expired', 'unavailable');

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "counterOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "copyId" TEXT,
    "cardId" TEXT NOT NULL,
    "finish" "Finish" NOT NULL,

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_counterOfId_key" ON "Trade"("counterOfId");

-- CreateIndex
CREATE INDEX "Trade_recipientId_status_idx" ON "Trade"("recipientId", "status");

-- CreateIndex
CREATE INDEX "Trade_proposerId_status_idx" ON "Trade"("proposerId", "status");

-- CreateIndex
CREATE INDEX "TradeItem_tradeId_idx" ON "TradeItem"("tradeId");

-- CreateIndex
CREATE INDEX "TradeItem_copyId_idx" ON "TradeItem"("copyId");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_counterOfId_fkey" FOREIGN KEY ("counterOfId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "CardCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
