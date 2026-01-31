-- AlterEnum
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PRINTING', 'HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED');

-- AlterTable
ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus" USING (
    CASE
      WHEN "status"::text = 'PROCESSING' THEN 'CREATED'
      WHEN "status"::text = 'PRINTING' THEN 'PRINTING'
      WHEN "status"::text = 'SHIPPED' THEN 'IN_TRANSIT'
      WHEN "status"::text = 'DELIVERED' THEN 'DELIVERED'
      ELSE 'CREATED'
    END::"OrderStatus"
  ),
  ALTER COLUMN "status" SET DEFAULT 'CREATED';

ALTER TABLE "Order"
  ADD COLUMN "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "carrier" TEXT;

UPDATE "Order" SET "statusUpdatedAt" = "createdAt" WHERE "statusUpdatedAt" IS NULL;

DROP TYPE "OrderStatus_old";
