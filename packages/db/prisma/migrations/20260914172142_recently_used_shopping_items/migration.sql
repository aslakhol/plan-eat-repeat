-- CreateTable
CREATE TABLE "RecentShoppingItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "note" TEXT,
    "recentlyUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" TEXT NOT NULL,

    CONSTRAINT "RecentShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecentShoppingItem_householdId_recentlyUsedAt_idx" ON "RecentShoppingItem"("householdId", "recentlyUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentShoppingItem_householdId_normalizedName_key" ON "RecentShoppingItem"("householdId", "normalizedName");

-- AddForeignKey
ALTER TABLE "RecentShoppingItem" ADD CONSTRAINT "RecentShoppingItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
