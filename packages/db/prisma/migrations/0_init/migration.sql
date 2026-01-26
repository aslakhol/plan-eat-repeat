-- CreateTable
CREATE TABLE "Dinner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "link" TEXT,
    "notes" TEXT,

    CONSTRAINT "Dinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "value" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("value")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dinnerId" INTEGER NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DinnerToTag" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Dinner_name_idx" ON "Dinner"("name");

-- CreateIndex
CREATE INDEX "Tag_value_idx" ON "Tag"("value");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_date_key" ON "Plan"("date");

-- CreateIndex
CREATE INDEX "Plan_date_idx" ON "Plan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "_DinnerToTag_AB_unique" ON "_DinnerToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_DinnerToTag_B_index" ON "_DinnerToTag"("B");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_dinnerId_fkey" FOREIGN KEY ("dinnerId") REFERENCES "Dinner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DinnerToTag" ADD CONSTRAINT "_DinnerToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Dinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DinnerToTag" ADD CONSTRAINT "_DinnerToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("value") ON DELETE CASCADE ON UPDATE CASCADE;

