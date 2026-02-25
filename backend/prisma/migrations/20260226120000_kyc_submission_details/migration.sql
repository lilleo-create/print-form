-- AlterEnum
ALTER TYPE "KycStatus" ADD VALUE IF NOT EXISTS 'REVISION';

-- AlterTable
ALTER TABLE "SellerKycSubmission"
ADD COLUMN "comment" TEXT,
ADD COLUMN "dropoffPvzId" TEXT,
ADD COLUMN "dropoffPvzMeta" JSONB,
ADD COLUMN "merchantData" JSONB;
