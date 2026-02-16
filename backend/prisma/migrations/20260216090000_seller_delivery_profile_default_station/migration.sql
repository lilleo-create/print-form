-- Ensure default profile can be created with only sellerId
ALTER TABLE "SellerDeliveryProfile"
  ALTER COLUMN "dropoffStationId" SET DEFAULT '';
