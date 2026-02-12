/*
  Warnings:

  - You are about to drop the `order_shipment_status_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_shipments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `seller_delivery_profile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "order_shipment_status_history" DROP CONSTRAINT "order_shipment_status_history_shipment_id_fkey";

-- DropForeignKey
ALTER TABLE "order_shipments" DROP CONSTRAINT "order_shipments_order_id_fkey";

-- DropForeignKey
ALTER TABLE "seller_delivery_profile" DROP CONSTRAINT "seller_delivery_profile_seller_id_fkey";

-- DropIndex
DROP INDEX "SellerSettings_sellerId_key";

-- DropTable
DROP TABLE "order_shipment_status_history";

-- DropTable
DROP TABLE "order_shipments";

-- DropTable
DROP TABLE "seller_delivery_profile";

-- CreateTable
CREATE TABLE "SellerDeliveryProfile" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "dropoffStationId" TEXT NOT NULL,
    "dropoffStationMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerDeliveryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderShipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "sourceStationId" TEXT NOT NULL,
    "sourceStationSnapshot" JSONB,
    "destinationStationId" TEXT NOT NULL,
    "destinationStationSnapshot" JSONB,
    "offerPayload" TEXT,
    "requestId" TEXT,
    "status" TEXT NOT NULL,
    "statusRaw" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderShipmentStatusHistory" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderShipmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerDeliveryProfile_sellerId_key" ON "SellerDeliveryProfile"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderShipment_orderId_key" ON "OrderShipment"("orderId");

-- AddForeignKey
ALTER TABLE "SellerDeliveryProfile" ADD CONSTRAINT "SellerDeliveryProfile_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShipment" ADD CONSTRAINT "OrderShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShipmentStatusHistory" ADD CONSTRAINT "OrderShipmentStatusHistory_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "OrderShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
