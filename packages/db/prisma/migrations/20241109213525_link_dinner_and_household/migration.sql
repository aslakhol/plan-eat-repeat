-- AlterTable
ALTER TABLE "Dinner" ADD COLUMN     "householdId" TEXT NOT NULL DEFAULT 'org_2od444SKLdkm5D1kfSTGqNfEfIq';

-- AddForeignKey
ALTER TABLE "Dinner" ADD CONSTRAINT "Dinner_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
