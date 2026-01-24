-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryDateEstimated" TIMESTAMP(3),
ADD COLUMN     "deliveryDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
