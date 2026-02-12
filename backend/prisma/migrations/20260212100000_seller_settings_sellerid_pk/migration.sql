-- Redefine SellerSettings primary key to sellerId (aligned with schema.prisma)
ALTER TABLE "SellerSettings" DROP CONSTRAINT IF EXISTS "SellerSettings_pkey";
ALTER TABLE "SellerSettings" DROP COLUMN IF EXISTS "id";
ALTER TABLE "SellerSettings" ADD CONSTRAINT "SellerSettings_pkey" PRIMARY KEY ("sellerId");
