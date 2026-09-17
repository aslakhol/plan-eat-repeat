-- CreateEnum
CREATE TYPE "OdaTransferResolution" AS ENUM ('ADDED', 'NOT_ADDED');

-- AlterTable
ALTER TABLE "OdaTransfer" ADD COLUMN "resolution" "OdaTransferResolution",
ADD COLUMN "resolvedByUserId" TEXT;

-- Preserve coverage eligibility for previously planned unspecified needs.
ALTER TABLE "OdaTransferOperation"
ADD COLUMN "unspecifiedRequirementIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "OdaTransferOperation"
SET "unspecifiedRequirementIds" = "requirementIds"
WHERE "canUseCartCoverage";
ALTER TABLE "OdaTransferOperation" DROP COLUMN "canUseCartCoverage";
