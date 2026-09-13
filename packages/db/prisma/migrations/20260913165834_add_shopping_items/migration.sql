-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "note" TEXT,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingItem_householdId_normalizedName_idx" ON "ShoppingItem"("householdId", "normalizedName");

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
