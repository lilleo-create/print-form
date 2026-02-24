-- AlterTable
ALTER TABLE "SellerSettings"
ADD COLUMN "defaultDropoffProvider" TEXT NOT NULL DEFAULT 'YANDEX_NDD';
