-- AlterTable
ALTER TABLE "AiImportAttempt"
ADD COLUMN "providerId" TEXT,
ADD COLUMN "requestedModelId" TEXT,
ADD COLUMN "responseModelId" TEXT,
ADD COLUMN "totalInputTokens" INTEGER,
ADD COLUMN "totalOutputTokens" INTEGER;
