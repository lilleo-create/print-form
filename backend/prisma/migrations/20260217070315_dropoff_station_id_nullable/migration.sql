-- This is an empty migration.
-- Make dropoffStationId nullable and remove any default
ALTER TABLE "SellerDeliveryProfile"
  ALTER COLUMN "dropoffStationId" DROP NOT NULL;

ALTER TABLE "SellerDeliveryProfile"
  ALTER COLUMN "dropoffStationId" DROP DEFAULT;

-- Normalize legacy empty strings to NULL (optional but correct)
UPDATE "SellerDeliveryProfile"
SET "dropoffStationId" = NULL
WHERE "dropoffStationId" = '';
