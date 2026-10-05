-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "dinnerIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
