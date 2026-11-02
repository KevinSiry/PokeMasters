-- AlterTable
ALTER TABLE "CardCopy" ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Binder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Binder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinderSlot" (
    "binderId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BinderSlot_pkey" PRIMARY KEY ("binderId","position")
);

-- CreateIndex
CREATE INDEX "Binder_ownerId_idx" ON "Binder"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BinderSlot_copyId_key" ON "BinderSlot"("copyId");

-- AddForeignKey
ALTER TABLE "Binder" ADD CONSTRAINT "Binder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinderSlot" ADD CONSTRAINT "BinderSlot_binderId_fkey" FOREIGN KEY ("binderId") REFERENCES "Binder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinderSlot" ADD CONSTRAINT "BinderSlot_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "CardCopy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
