-- Technical provenance for detached Published Dinner copies. Intentionally no
-- foreign key: the identity must survive deletion of the source Dinner.
ALTER TABLE "Dinner" ADD COLUMN "sourceDinnerId" INTEGER;

CREATE INDEX "Dinner_sourceDinnerId_idx" ON "Dinner"("sourceDinnerId");
