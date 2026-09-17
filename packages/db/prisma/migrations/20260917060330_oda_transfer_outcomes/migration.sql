-- CreateEnum
CREATE TYPE "OdaTransferState" AS ENUM ('MATCHING', 'SENDING', 'COMPLETED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "OdaOperationState" AS ENUM ('PENDING', 'WRITING', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "OdaConnection" ADD COLUMN "connectionId" TEXT;
UPDATE "OdaConnection" SET "connectionId" = gen_random_uuid()::text;
ALTER TABLE "OdaConnection" ALTER COLUMN "connectionId" SET NOT NULL;

-- CreateTable
CREATE TABLE "OdaTransfer" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "state" "OdaTransferState" NOT NULL DEFAULT 'MATCHING',
    "snapshot" JSONB NOT NULL,
    "cartUrl" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdaTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdaTransferOperation" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "beforeQuantity" INTEGER NOT NULL,
    "requirementIds" TEXT[],
    "state" "OdaOperationState" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "OdaTransferOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OdaTransfer_householdId_createdAt_idx" ON "OdaTransfer"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "OdaTransferOperation_transferId_idx" ON "OdaTransferOperation"("transferId");

-- AddForeignKey
ALTER TABLE "OdaTransfer" ADD CONSTRAINT "OdaTransfer_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdaTransferOperation" ADD CONSTRAINT "OdaTransferOperation_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "OdaTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
