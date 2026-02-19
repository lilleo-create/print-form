/*
  Warnings:

  - Made the column `dropoffStationId` on table `SellerDeliveryProfile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SellerDeliveryProfile" ALTER COLUMN "dropoffStationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "order_delivery_data" (
    "order_id" TEXT NOT NULL,
    "delivery_payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_delivery_data_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_shipment_status_history" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload_raw" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_shipment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "delivery_method" TEXT NOT NULL,
    "source_station_id" TEXT NOT NULL,
    "source_station_snapshot" JSONB,
    "destination_station_id" TEXT NOT NULL,
    "destination_station_snapshot" JSONB,
    "offer_payload" TEXT,
    "request_id" TEXT,
    "status" TEXT NOT NULL,
    "status_raw" JSONB,
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_checkout_preferences" (
    "user_id" TEXT NOT NULL,
    "delivery_method" TEXT NOT NULL DEFAULT 'COURIER',
    "delivery_sub_type" TEXT,
    "delivery_provider" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'CARD',
    "selected_card_id" TEXT,
    "pickup_point_id" TEXT,
    "pickup_provider" TEXT,
    "pickup_point_json" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_checkout_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_saved_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "exp_month" INTEGER NOT NULL,
    "exp_year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_order_id_key" ON "order_shipments"("order_id");

-- AddForeignKey
ALTER TABLE "order_shipment_status_history" ADD CONSTRAINT "order_shipment_status_history_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
