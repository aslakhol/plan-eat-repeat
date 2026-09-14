-- AlterTable
ALTER TABLE "RecentShoppingItem" ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "UsuallyHave" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "ShoppingProduct" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,

    CONSTRAINT "ShoppingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingProduct_householdId_normalizedName_key" ON "ShoppingProduct"("householdId", "normalizedName");

-- Remember all existing shopping names before linking their visible collections.
-- Categories are deliberately left for the categorization migration.
INSERT INTO "ShoppingProduct" (id, "householdId", name, "normalizedName")
SELECT gen_random_uuid()::text, "householdId", min(name), "normalizedName"
FROM (
    SELECT "householdId", name, "normalizedName" FROM "ShoppingItem"
    UNION ALL
    SELECT "householdId", name, "normalizedName" FROM "RecentShoppingItem"
    UNION ALL
    SELECT "householdId", name, "normalizedName" FROM "UsuallyHave"
) AS names
GROUP BY "householdId", "normalizedName";

UPDATE "ShoppingItem" AS item SET "productId" = product.id
FROM "ShoppingProduct" AS product
WHERE product."householdId" = item."householdId"
    AND product."normalizedName" = item."normalizedName";
ALTER TABLE "ShoppingItem" ALTER COLUMN "productId" SET NOT NULL;

UPDATE "RecentShoppingItem" AS item SET "productId" = product.id
FROM "ShoppingProduct" AS product
WHERE product."householdId" = item."householdId"
    AND product."normalizedName" = item."normalizedName";
ALTER TABLE "RecentShoppingItem" ALTER COLUMN "productId" SET NOT NULL;

UPDATE "UsuallyHave" AS item SET "productId" = product.id
FROM "ShoppingProduct" AS product
WHERE product."householdId" = item."householdId"
    AND product."normalizedName" = item."normalizedName";
ALTER TABLE "UsuallyHave" ALTER COLUMN "productId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ShoppingProduct" ADD CONSTRAINT "ShoppingProduct_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShoppingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuallyHave" ADD CONSTRAINT "UsuallyHave_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShoppingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentShoppingItem" ADD CONSTRAINT "RecentShoppingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShoppingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

