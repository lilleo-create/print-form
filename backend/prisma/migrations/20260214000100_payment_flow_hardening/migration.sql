-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "paymentAttemptKey" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_buyerId_paymentAttemptKey_key"
ON "Order"("buyerId", "paymentAttemptKey");
