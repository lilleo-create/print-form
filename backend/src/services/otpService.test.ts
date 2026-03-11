import test from 'node:test';
import assert from 'node:assert/strict';
import { otpService } from './otpService';
import { prisma } from '../lib/prisma';
import { plusofonOtpProvider } from './providers/plusofonOtpProvider';
import { env } from '../config/env';
import { otpDeliveryService } from './otpDeliveryService';

const basePayload = { phone: '+79990000000', purpose: 'buyer_register_phone' as const };

test('provider happy path returns plusofon response', async () => {
  env.otpProvider = 'plusofon';
  env.otpFallbackEnabled = false;
  (prisma.otpVerification.count as any) = async () => 0;
  (prisma.otpVerification.findFirst as any) = async () => null;
  (plusofonOtpProvider.startVerification as any) = async () => ({
    provider: 'PLUSOFON',
    verificationType: 'call_to_auth',
    externalKey: 'abc12345',
    externalPhone: '+78005553535',
    deliveryStatus: 'SENT'
  });
  (prisma.otpVerification.create as any) = async ({ data }: any) => ({
    id: 'otp_1',
    ...data,
    status: 'PENDING'
  });

  const result: any = await otpService.requestOtp(basePayload);
  assert.equal(result.data.provider, 'plusofon');
  assert.equal(result.data.callToAuthNumber, '+78005553535');
});

test('webhook happy path marks verification as verified', async () => {
  (prisma.otpVerification.findFirst as any) = async () => ({
    id: 'otp_1',
    normalizedPhone: '+79990000000',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 10_000)
  });
  let updateCalled = false;
  (prisma.otpVerification.update as any) = async () => {
    updateCalled = true;
    return {};
  };

  const result = await otpService.markPlusofonVerified({ phone: '+79990000000', key: 'abc123' });
  assert.equal(result.ok, true);
  assert.equal(updateCalled, true);
});

test('duplicate webhook is idempotent', async () => {
  (prisma.otpVerification.findFirst as any) = async () => ({
    id: 'otp_1',
    normalizedPhone: '+79990000000',
    status: 'VERIFIED',
    expiresAt: new Date(Date.now() + 10_000)
  });

  const result = await otpService.markPlusofonVerified({ phone: '+79990000000', key: 'abc123' });
  assert.equal(result.accepted, true);
});

test('expired session is not verified', async () => {
  (prisma.otpVerification.findFirst as any) = async () => ({
    id: 'otp_1',
    normalizedPhone: '+79990000000',
    status: 'PENDING',
    expiresAt: new Date(Date.now() - 10_000)
  });
  let status = '';
  (prisma.otpVerification.update as any) = async ({ data }: any) => {
    status = data.status;
    return {};
  };

  await otpService.markPlusofonVerified({ phone: '+79990000000', key: 'abc123' });
  assert.equal(status, 'EXPIRED');
});

test('provider failure without fallback enabled throws OTP_PROVIDER_UNAVAILABLE', async () => {
  env.otpProvider = 'plusofon';
  env.otpFallbackEnabled = false;
  (prisma.otpVerification.count as any) = async () => 0;
  (prisma.otpVerification.findFirst as any) = async () => null;
  (plusofonOtpProvider.startVerification as any) = async () => {
    throw new Error('boom');
  };

  await assert.rejects(() => otpService.requestOtp(basePayload), /OTP_PROVIDER_UNAVAILABLE/);
});

test('provider failure with fallback enabled uses telegram fallback', async () => {
  env.otpProvider = 'plusofon';
  env.otpFallbackEnabled = true;
  env.otpFallbackProvider = 'telegram';
  (prisma.otpVerification.count as any) = async () => 0;
  (prisma.otpVerification.findFirst as any) = async () => null;
  (plusofonOtpProvider.startVerification as any) = async () => {
    throw new Error('boom');
  };
  (prisma.phoneOtp.create as any) = async () => ({ id: 'phone_1', createdAt: new Date() });
  (otpDeliveryService.sendOtp as any) = async () => ({ channel: 'TELEGRAM', provider: 'TELEGRAM_GATEWAY', deliveryStatus: 'SENT' });
  (prisma.phoneOtp.update as any) = async () => ({});
  (prisma.otpVerification.create as any) = async ({ data }: any) => ({ id: 'otp_fallback', ...data });

  const result: any = await otpService.requestOtp(basePayload);
  assert.equal(result.data.provider, 'telegram');
});
