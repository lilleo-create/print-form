-- Add seller/support metadata for chat threads
ALTER TABLE "ChatThread"
  ADD COLUMN IF NOT EXISTS "sellerId" TEXT,
  ADD COLUMN IF NOT EXISTS "sellerShopName" TEXT,
  ADD COLUMN IF NOT EXISTS "supportTopic" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ChatThread_userId_kind_sellerId_key"
  ON "ChatThread"("userId", "kind", "sellerId");
