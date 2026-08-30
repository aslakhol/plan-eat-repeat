-- CreateEnum
CREATE TYPE "AiImportSource" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'LINK', 'TEXT', 'PHOTO');

-- CreateEnum
CREATE TYPE "AiImportInferenceState" AS ENUM ('PENDING', 'NOT_INCURRED', 'ESTIMATED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Household"
ADD COLUMN "aiImportSpendAttributionKey" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "Membership"
ADD COLUMN "aiImportSpendAttributionKey" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Prisma supplies UUID defaults when new records are created. The temporary
-- database defaults above exist only to backfill stable keys during migration.
ALTER TABLE "Household"
ALTER COLUMN "aiImportSpendAttributionKey" DROP DEFAULT;

ALTER TABLE "Membership"
ALTER COLUMN "aiImportSpendAttributionKey" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AiImportAttempt" (
    "id" TEXT NOT NULL,
    "source" "AiImportSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "householdId" TEXT,
    "membershipId" INTEGER,
    "householdAttributionKey" TEXT NOT NULL,
    "membershipAttributionKey" TEXT NOT NULL,
    "inferenceState" "AiImportInferenceState" NOT NULL DEFAULT 'PENDING',
    "inferenceStartedAt" TIMESTAMP(3),
    "estimatedAiImportCostUsd" DOUBLE PRECISION,
    "supadataOperationsStarted" INTEGER NOT NULL DEFAULT 0,
    "supadataCredits" INTEGER NOT NULL DEFAULT 0,
    "supadataUnknownOperationCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiImportAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Household_aiImportSpendAttributionKey_key" ON "Household"("aiImportSpendAttributionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_aiImportSpendAttributionKey_key" ON "Membership"("aiImportSpendAttributionKey");

-- CreateIndex
CREATE INDEX "AiImportAttempt_startedAt_idx" ON "AiImportAttempt"("startedAt");

-- CreateIndex
CREATE INDEX "AiImportAttempt_householdAttributionKey_startedAt_idx" ON "AiImportAttempt"("householdAttributionKey", "startedAt");

-- CreateIndex
CREATE INDEX "AiImportAttempt_membershipAttributionKey_startedAt_idx" ON "AiImportAttempt"("membershipAttributionKey", "startedAt");

-- AddForeignKey
ALTER TABLE "AiImportAttempt" ADD CONSTRAINT "AiImportAttempt_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiImportAttempt" ADD CONSTRAINT "AiImportAttempt_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
