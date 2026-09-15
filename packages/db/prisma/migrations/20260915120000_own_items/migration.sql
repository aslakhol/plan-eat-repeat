-- Preserve name-only memory and create separate definitions for every existing note.
CREATE TABLE "OwnItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "note" TEXT,
    "normalizedNote" TEXT NOT NULL DEFAULT '',
    "category" "ShoppingCategory" NOT NULL,
    "usuallyHave" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OwnItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OwnItem_householdId_normalizedName_normalizedNote_key" ON "OwnItem"("householdId", "normalizedName", "normalizedNote");
CREATE UNIQUE INDEX "OwnItem_id_householdId_key" ON "OwnItem"("id", "householdId");
ALTER TABLE "OwnItem" ADD CONSTRAINT "OwnItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "OwnItem" (id, "householdId", name, "normalizedName", category, "usuallyHave")
SELECT p.id, p."householdId", p.name, p."normalizedName", p.category,
       EXISTS (SELECT 1 FROM "UsuallyHave" u WHERE u."productId" = p.id)
FROM "ShoppingProduct" p;

WITH variants AS (
    SELECT "productId", name, note, id FROM "ShoppingItem"
    UNION ALL
    SELECT "productId", name, note, id FROM "RecentShoppingItem"
), normalized AS (
    SELECT *, lower(trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g'))) AS "normalizedNote"
    FROM variants
)
INSERT INTO "OwnItem" (id, "householdId", name, "normalizedName", note, "normalizedNote", category, "usuallyHave")
SELECT DISTINCT ON (p.id, n."normalizedNote")
       p.id || ':' || md5(n."normalizedNote"), p."householdId", n.name, p."normalizedName",
       trim(n.note), n."normalizedNote", p.category,
       EXISTS (SELECT 1 FROM "UsuallyHave" u WHERE u."productId" = p.id)
FROM normalized n JOIN "ShoppingProduct" p ON p.id = n."productId"
WHERE n."normalizedNote" <> ''
ORDER BY p.id, n."normalizedNote", n.id;

ALTER TABLE "ShoppingItem" ADD COLUMN "ownItemId" TEXT;
ALTER TABLE "ShoppingItem" ADD COLUMN "revision" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "ShoppingItem" ALTER COLUMN "revision" DROP DEFAULT;
ALTER TABLE "RecentShoppingItem" ADD COLUMN "ownItemId" TEXT;
UPDATE "ShoppingItem" SET "ownItemId" = "productId" ||
    CASE WHEN trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g')) = '' THEN ''
    ELSE ':' || md5(lower(trim(regexp_replace(note, '\s+', ' ', 'g')))) END;
UPDATE "RecentShoppingItem" SET "ownItemId" = "productId" ||
    CASE WHEN trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g')) = '' THEN ''
    ELSE ':' || md5(lower(trim(regexp_replace(note, '\s+', ' ', 'g')))) END;

ALTER TABLE "ShoppingItem" ALTER COLUMN "ownItemId" SET NOT NULL;
ALTER TABLE "RecentShoppingItem" ALTER COLUMN "ownItemId" SET NOT NULL;
ALTER TABLE "ShoppingItem" DROP COLUMN "productId", DROP COLUMN name, DROP COLUMN "normalizedName", DROP COLUMN note;
ALTER TABLE "RecentShoppingItem" DROP COLUMN "productId", DROP COLUMN name, DROP COLUMN "normalizedName", DROP COLUMN note;
DROP TABLE "UsuallyHave";
DROP TABLE "ShoppingProduct";
CREATE INDEX "ShoppingItem_householdId_ownItemId_idx" ON "ShoppingItem"("householdId", "ownItemId");
CREATE UNIQUE INDEX "RecentShoppingItem_ownItemId_key" ON "RecentShoppingItem"("ownItemId");
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_ownItemId_householdId_fkey" FOREIGN KEY ("ownItemId", "householdId") REFERENCES "OwnItem"("id", "householdId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecentShoppingItem" ADD CONSTRAINT "RecentShoppingItem_ownItemId_householdId_fkey" FOREIGN KEY ("ownItemId", "householdId") REFERENCES "OwnItem"("id", "householdId") ON DELETE CASCADE ON UPDATE CASCADE;
