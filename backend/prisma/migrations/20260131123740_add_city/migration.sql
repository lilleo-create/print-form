/*
  Warnings:

  - A unique constraint covering the columns `[name,country]` on the table `City` will be added. If there are existing duplicate values, this will fail.
  - Made the column `country` on table `City` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "City_name_idx";

-- AlterTable
ALTER TABLE "City" ALTER COLUMN "country" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "City_name_country_key" ON "City"("name", "country");
