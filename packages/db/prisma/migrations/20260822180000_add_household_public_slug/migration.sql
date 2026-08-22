ALTER TABLE "Household" ADD COLUMN "publicSlug" TEXT;

-- Existing Households with a live Public Dinner List need an identity as soon
-- as this migration lands. Future identities are created when publishing.
UPDATE "Household" AS household
SET "publicSlug" = CONCAT(
    COALESCE(
        NULLIF(
            TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(household."name"), '[^a-z0-9]+', '-', 'g')),
            ''
        ),
        'household'
    ),
    '-',
    SUBSTRING(
        MD5(household."id" || RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
        1,
        12
    )
)
WHERE EXISTS (
    SELECT 1
    FROM "Dinner" AS dinner
    WHERE dinner."householdId" = household."id"
      AND dinner."publishedAt" IS NOT NULL
);

CREATE UNIQUE INDEX "Household_publicSlug_key" ON "Household"("publicSlug");
