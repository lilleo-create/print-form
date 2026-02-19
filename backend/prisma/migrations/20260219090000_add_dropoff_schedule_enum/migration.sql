DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DropoffSchedule') THEN
    CREATE TYPE "DropoffSchedule" AS ENUM ('DAILY', 'WEEKDAYS');
  END IF;
END $$;

ALTER TABLE "SellerDeliveryProfile"
  ADD COLUMN IF NOT EXISTS "dropoffSchedule" "DropoffSchedule" NOT NULL DEFAULT 'DAILY';

UPDATE "SellerDeliveryProfile"
SET "dropoffSchedule" = 'DAILY'
WHERE "dropoffSchedule" IS NULL;

UPDATE "SellerDeliveryProfile"
SET "dropoffStationId" = ''
WHERE "dropoffStationId" IS NULL;

ALTER TABLE "SellerDeliveryProfile"
  ALTER COLUMN "dropoffStationId" SET NOT NULL,
  ALTER COLUMN "dropoffSchedule" SET DEFAULT 'DAILY';
