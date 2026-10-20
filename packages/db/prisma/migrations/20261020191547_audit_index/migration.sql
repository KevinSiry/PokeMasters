-- Index manquants relevés par l'audit fonctionnel (2026-10-20).

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_id_idx" ON "LedgerEntry"("userId", "id");

-- CreateIndex
CREATE INDEX "Listing_currentBidderId_status_idx" ON "Listing"("currentBidderId", "status");

-- CreateIndex
CREATE INDEX "Report_reporterId_targetId_createdAt_idx" ON "Report"("reporterId", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_sellerId_idx" ON "Sale"("sellerId");

-- CreateIndex
CREATE INDEX "Sale_buyerId_idx" ON "Sale"("buyerId");
