-- AlterTable
ALTER TABLE "OdaTransfer" ADD COLUMN     "leaseUntil" TIMESTAMP(3),
ADD COLUMN     "runId" TEXT;

-- AlterTable
ALTER TABLE "OdaTransferOperation" ADD COLUMN     "canUseCartCoverage" BOOLEAN NOT NULL DEFAULT false;
