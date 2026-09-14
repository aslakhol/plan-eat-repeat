-- Match the whitespace recognized by JavaScript's normalizeShoppingName.
CREATE FUNCTION pg_temp.normalize_shopping_name(name TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE AS $$
    SELECT lower(btrim(regexp_replace(name,
        U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
        ' ', 'g')));
$$;

-- Keep every active quantity requirement and its shopping details.
UPDATE "ShoppingItem" SET "normalizedName" = pg_temp.normalize_shopping_name(name);

-- Formatting variants become one reusable name, keeping the latest details.
DELETE FROM "RecentShoppingItem" WHERE id IN (
    SELECT id FROM (
        SELECT id, row_number() OVER (
            PARTITION BY "householdId", pg_temp.normalize_shopping_name(name)
            ORDER BY "recentlyUsedAt" DESC, id ASC
        ) AS position FROM "RecentShoppingItem"
    ) AS ranked WHERE position > 1
);
UPDATE "RecentShoppingItem" SET "normalizedName" = pg_temp.normalize_shopping_name(name);

DELETE FROM "UsuallyHave" WHERE ("householdId", "normalizedName") IN (
    SELECT "householdId", "normalizedName" FROM (
        SELECT "householdId", "normalizedName", row_number() OVER (
            PARTITION BY "householdId", pg_temp.normalize_shopping_name(name)
            ORDER BY "normalizedName" ASC
        ) AS position FROM "UsuallyHave"
    ) AS ranked WHERE position > 1
);
UPDATE "UsuallyHave" SET "normalizedName" = pg_temp.normalize_shopping_name(name);
