/*
  Warnings:

  - You are about to drop the column `profileImageUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "profileImageUrl",
ADD COLUMN     "imageUrl" TEXT;
