-- Add moderation enums
CREATE TYPE "ProductModerationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_EDIT', 'ARCHIVED');
CREATE TYPE "ReviewModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_EDIT');

-- Product moderation fields
ALTER TABLE "Product"
  ADD COLUMN "moderationStatus" "ProductModerationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "moderationNotes" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ADD COLUMN "moderatedById" TEXT;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_moderatedById_fkey"
  FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Review moderation fields
ALTER TABLE "Review"
  ADD COLUMN "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "moderationNotes" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ADD COLUMN "moderatedById" TEXT;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_moderatedById_fkey"
  FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing data
UPDATE "Product" SET "moderationStatus" = 'APPROVED';
UPDATE "Review"
  SET "moderationStatus" = CASE WHEN "status" = 'APPROVED' THEN 'APPROVED' ELSE 'PENDING' END;
