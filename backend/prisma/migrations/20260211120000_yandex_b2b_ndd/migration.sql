-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN "weightGrossG" INTEGER,
  ADD COLUMN "dxCm" INTEGER,
  ADD COLUMN "dyCm" INTEGER,
  ADD COLUMN "dzCm" INTEGER;

ALTER TABLE "Order"
  ADD COLUMN "buyerPickupPvzId" TEXT,
  ADD COLUMN "buyerPickupPvzMeta" JSONB,
  ADD COLUMN "sellerDropoffPvzId" TEXT,
  ADD COLUMN "sellerDropoffPvzMeta" JSONB,
  ADD COLUMN "yandexOfferId" TEXT,
  ADD COLUMN "yandexRequestId" TEXT,
  ADD COLUMN "yandexStatus" TEXT,
  ADD COLUMN "yandexSharingUrl" TEXT,
  ADD COLUMN "yandexCourierOrderId" TEXT,
  ADD COLUMN "yandexSelfPickupCode" JSONB,
  ADD COLUMN "yandexActualInfo" JSONB,
  ADD COLUMN "payoutStatus" TEXT NOT NULL DEFAULT 'HOLD',
  ADD COLUMN "readyForShipmentAt" TIMESTAMP(3),
  ADD COLUMN "dropoffDeadlineAt" TIMESTAMP(3);

CREATE TABLE "SellerSettings" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "defaultDropoffPvzId" TEXT,
  "defaultDropoffPvzMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerSettings_sellerId_key" ON "SellerSettings"("sellerId");
ALTER TABLE "SellerSettings" ADD CONSTRAINT "SellerSettings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrderDeliveryEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "description" TEXT,
  "reason" TEXT,
  "timestampUnix" INTEGER,
  "timestampUtc" TEXT,
  "raw" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderDeliveryEvent_orderId_createdAt_idx" ON "OrderDeliveryEvent"("orderId", "createdAt");
ALTER TABLE "OrderDeliveryEvent" ADD CONSTRAINT "OrderDeliveryEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_SHIPMENT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
