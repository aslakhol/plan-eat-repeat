/*
  Warnings:

  - You are about to drop the column `link` on the `Invite` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Invite_link_key";

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN "link";
