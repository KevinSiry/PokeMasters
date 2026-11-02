-- CreateTable
CREATE TABLE "WeeklySet" (
    "week" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklySet_pkey" PRIMARY KEY ("week")
);

-- AddForeignKey
ALTER TABLE "WeeklySet" ADD CONSTRAINT "WeeklySet_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Set"("id") ON DELETE CASCADE ON UPDATE CASCADE;
