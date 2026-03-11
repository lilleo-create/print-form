-- AlterEnum
ALTER TYPE "OtpChannel" ADD VALUE IF NOT EXISTS 'CALL_TO_AUTH';

-- AlterEnum
ALTER TYPE "OtpProvider" ADD VALUE IF NOT EXISTS 'PLUSOFON';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OtpVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "provider" "OtpProvider" NOT NULL,
    "purpose" "OtpPurpose",
    "status" "OtpVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "externalKey" TEXT,
    "externalPhone" TEXT,
    "fallbackProvider" "OtpProvider",
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpVerification_normalizedPhone_status_idx" ON "OtpVerification"("normalizedPhone", "status");

-- CreateIndex
CREATE INDEX "OtpVerification_externalKey_idx" ON "OtpVerification"("externalKey");

-- CreateIndex
CREATE INDEX "OtpVerification_createdAt_idx" ON "OtpVerification"("createdAt");
