-- CreateEnum
CREATE TYPE "ShoppingLanguage" AS ENUM ('en', 'no');

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "shoppingLanguage" "ShoppingLanguage" NOT NULL DEFAULT 'en';
