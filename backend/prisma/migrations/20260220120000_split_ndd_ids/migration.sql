ALTER TABLE "SellerDeliveryProfile"
  ALTER COLUMN "dropoffStationId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "dropoffPvzId" TEXT,
  ADD COLUMN IF NOT EXISTS "dropoffOperatorStationId" TEXT,
  ADD COLUMN IF NOT EXISTS "dropoffPlatformStationId" TEXT;

UPDATE "SellerDeliveryProfile"
SET "dropoffPlatformStationId" = COALESCE(NULLIF(TRIM("dropoffPlatformStationId"), ''), NULLIF(TRIM("dropoffStationId"), ''))
WHERE "dropoffPlatformStationId" IS NULL;
