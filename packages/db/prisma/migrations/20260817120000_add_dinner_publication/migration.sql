-- AlterTable
ALTER TABLE "Dinner"
ADD COLUMN "publicSlug" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Dinner_publicSlug_key" ON "Dinner"("publicSlug");

-- CreateIndex
CREATE INDEX "Dinner_publishedAt_idx" ON "Dinner"("publishedAt");
