-- CreateTable
CREATE TABLE "FavoriteCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteCard_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "WishlistCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistCard_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateIndex
CREATE INDEX "FavoriteCard_userId_createdAt_idx" ON "FavoriteCard"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WishlistCard_userId_createdAt_idx" ON "WishlistCard"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WishlistCard_cardId_idx" ON "WishlistCard"("cardId");

-- AddForeignKey
ALTER TABLE "FavoriteCard" ADD CONSTRAINT "FavoriteCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCard" ADD CONSTRAINT "FavoriteCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistCard" ADD CONSTRAINT "WishlistCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistCard" ADD CONSTRAINT "WishlistCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
