-- CreateTable
CREATE TABLE "ShoppingDinnerAddition" (
    "householdId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "dinnerIds" INTEGER[],
    "result" TEXT NOT NULL,

    CONSTRAINT "ShoppingDinnerAddition_pkey" PRIMARY KEY ("householdId","operationId")
);

-- AddForeignKey
ALTER TABLE "ShoppingDinnerAddition" ADD CONSTRAINT "ShoppingDinnerAddition_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
