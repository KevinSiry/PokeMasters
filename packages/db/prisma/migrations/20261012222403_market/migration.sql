-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('fixed', 'auction');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'sold', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "copyId" TEXT,
    "cardId" TEXT NOT NULL,
    "finish" "Finish" NOT NULL,
    "type" "ListingType" NOT NULL,
    "price" INTEGER NOT NULL,
    "currentBid" INTEGER,
    "currentBidderId" TEXT,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "endsAt" TIMESTAMP(3),
    "status" "ListingStatus" NOT NULL DEFAULT 'active',
    "fee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "finish" "Finish" NOT NULL,
    "price" INTEGER NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_status_endsAt_idx" ON "Listing"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Listing_cardId_status_idx" ON "Listing"("cardId", "status");

-- CreateIndex
CREATE INDEX "Listing_sellerId_status_idx" ON "Listing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_listingId_amount_idx" ON "Bid"("listingId", "amount");

-- CreateIndex
CREATE INDEX "Bid_bidderId_createdAt_idx" ON "Bid"("bidderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_listingId_key" ON "Sale"("listingId");

-- CreateIndex
CREATE INDEX "Sale_cardId_createdAt_idx" ON "Sale"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "CardCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un exemplaire n'a qu'une annonce active à la fois (empêche la double mise en vente).
CREATE UNIQUE INDEX "Listing_copyId_active_key" ON "Listing" ("copyId") WHERE status = 'active';
-- Montants strictement positifs.
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_price_positive" CHECK ("price" > 0 AND "fee" >= 0);
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_auction_shape" CHECK ("type" = 'fixed' OR "endsAt" IS NOT NULL);
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_price_positive" CHECK ("price" > 0);
