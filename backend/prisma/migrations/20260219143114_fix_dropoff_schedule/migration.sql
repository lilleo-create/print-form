/*
  Warnings:

  - The values [WEEKLY] on the enum `DropoffSchedule` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DropoffSchedule_new" AS ENUM ('DAILY', 'WEEKDAYS');
ALTER TABLE "SellerDeliveryProfile" ALTER COLUMN "dropoffSchedule" DROP DEFAULT;
ALTER TABLE "SellerDeliveryProfile" ALTER COLUMN "dropoffSchedule" TYPE "DropoffSchedule_new" USING ("dropoffSchedule"::text::"DropoffSchedule_new");
ALTER TYPE "DropoffSchedule" RENAME TO "DropoffSchedule_old";
ALTER TYPE "DropoffSchedule_new" RENAME TO "DropoffSchedule";
DROP TYPE "DropoffSchedule_old";
ALTER TABLE "SellerDeliveryProfile" ALTER COLUMN "dropoffSchedule" SET DEFAULT 'DAILY';
COMMIT;
