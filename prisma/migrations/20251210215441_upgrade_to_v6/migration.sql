-- AlterTable
ALTER TABLE "_DinnerToTag" ADD CONSTRAINT "_DinnerToTag_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DinnerToTag_AB_unique";
