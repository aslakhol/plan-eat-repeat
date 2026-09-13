-- CreateTable
CREATE TABLE "UsuallyHave" (
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,

    CONSTRAINT "UsuallyHave_pkey" PRIMARY KEY ("householdId","normalizedName")
);

-- AddForeignKey
ALTER TABLE "UsuallyHave" ADD CONSTRAINT "UsuallyHave_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
