-- AlterTable
ALTER TABLE "Dinner" ADD COLUMN     "servings" INTEGER;

-- CreateTable
CREATE TABLE "RecipePart" (
    "id" SERIAL NOT NULL,
    "dinnerId" INTEGER NOT NULL,
    "name" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "RecipePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "note" TEXT,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipePart_dinnerId_idx" ON "RecipePart"("dinnerId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_partId_idx" ON "RecipeIngredient"("partId");

-- CreateIndex
CREATE INDEX "RecipeStep_partId_idx" ON "RecipeStep"("partId");

-- AddForeignKey
ALTER TABLE "RecipePart" ADD CONSTRAINT "RecipePart_dinnerId_fkey" FOREIGN KEY ("dinnerId") REFERENCES "Dinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_partId_fkey" FOREIGN KEY ("partId") REFERENCES "RecipePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_partId_fkey" FOREIGN KEY ("partId") REFERENCES "RecipePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
