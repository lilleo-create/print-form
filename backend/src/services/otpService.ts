import crypto from 'crypto';
import {
  OtpDeliveryStatus,
  OtpPurpose as PrismaOtpPurpose,
  OtpVerificationStatus,
  type OtpVerification
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { generateOtpCode, hashOtpCode } from '../utils/otp';
import { normalizePhone } from '../utils/phone';
import { otpDeliveryService } from './otpDeliveryService';
import { plusofonOtpProvider } from './providers/plusofonOtpProvider';
import { OtpError } from './otpErrors';

const otpRequestWindowMs = 15 * 60 * 1000;
const otpMaxPerPhoneWindow = 3;

const otpVerificationDelegate = (prisma as any).otpVerification as typeof prisma.otpVerification | undefined;

if (!otpVerificationDelegate) {
  throw new Error('Prisma client is outdated: otpVerification delegate is missing. Run `npx prisma generate` in backend/.');
}


export type OtpPurpose =
  | 'buyer_register_phone'
  | 'buyer_change_phone'
  | 'buyer_sensitive_action'
  | 'seller_connect_phone'
  | 'seller_change_payout_details'
  | 'seller_payout_settings_verify'
  | 'password_reset';

const purposeToDb: Record<OtpPurpose, PrismaOtpPurpose> = {
  buyer_register_phone: 'BUYER_REGISTER_PHONE',
  buyer_change_phone: 'BUYER_CHANGE_PHONE',
  buyer_sensitive_action: 'BUYER_SENSITIVE_ACTION',
  seller_connect_phone: 'SELLER_CONNECT_PHONE',
  seller_change_payout_details: 'SELLER_CHANGE_PAYOUT_DETAILS',
  seller_payout_settings_verify: 'SELLER_PAYOUT_SETTINGS_VERIFY',
  password_reset: 'PASSWORD_RESET'
};

const maskPhone = (phone: string) => phone.replace(/.(?=.{4})/g, '*');

const formatPurpose = (purpose: OtpPurpose) => {
  switch (purpose) {
    case 'buyer_register_phone':
      return 'подтверждения телефона при регистрации';
    case 'buyer_change_phone':
      return 'смены телефона';
    case 'buyer_sensitive_action':
      return 'подтверждения чувствительного действия';
    case 'seller_connect_phone':
      return 'подключения продавца';
    case 'seller_change_payout_details':
      return 'изменения реквизитов продавца';
    case 'seller_payout_settings_verify':
      return 'подтверждения настроек выплат';
    default:
      return 'сброса пароля';
  }
};

const mapVerificationStatus = (status: OtpVerificationStatus) => status.toLowerCase();

const buildPlusofonStartResponse = (verification: OtpVerification) => ({
  requestId: verification.id,
  provider: 'plusofon',
  verificationType: 'call_to_auth' as const,
  callToAuthNumber: verification.externalPhone,
  phone: maskPhone(verification.normalizedPhone),
  status: mapVerificationStatus(verification.status),
  expiresInSec: Math.max(0, Math.floor(((verification.expiresAt?.getTime() ?? 0) - Date.now()) / 1000)),
  fallbackAvailable: env.otpFallbackEnabled && env.otpFallbackProvider === 'telegram'
});

const requestClassicOtp = async (payload: { phone: string; purpose: OtpPurpose; ip?: string; userAgent?: string }) => {
  const phone = normalizePhone(payload.phone);
  const purpose = purposeToDb[payload.purpose];
  const now = new Date();
  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + env.otpTtlMinutes * 60 * 1000);
  const created = await prisma.phoneOtp.create({
    data: {
      phone,
      purpose,
      codeHash: hashOtpCode(code),
      expiresAt,
      maxAttempts: env.otpMaxAttempts,
      ip: payload.ip,
      userAgent: payload.userAgent,
      providerPayload: { source: 'fallback', purpose: payload.purpose }
    }
  });

  const message = `Ваш код для ${formatPurpose(payload.purpose)}: ${code}`;
  const callbackUrl = `${env.backendUrl.replace(/\/$/, '')}/auth/otp/telegram/callback`;
  const internalRequestId = `otp_${created.id}_${Date.now()}`;

  const delivery = await otpDeliveryService.sendOtp({
    phone,
    code,
    ttlSeconds: env.otpTtlMinutes * 60,
    message,
    requestId: internalRequestId,
    callbackUrl,
    providerPayload: created.id
  });

  await prisma.phoneOtp.update({
    where: { id: created.id },
    data: {
      channel: delivery.channel,
      provider: delivery.provider,
      providerRequestId: delivery.providerRequestId,
      providerPayload: delivery.providerPayload ?? undefined,
      deliveryStatus: delivery.deliveryStatus
    }
  });

  const verification = await otpVerificationDelegate.create({
    data: {
      phone,
      normalizedPhone: phone,
      provider: 'TELEGRAM_GATEWAY',
      purpose,
      status: 'PENDING',
      fallbackProvider: 'TELEGRAM_GATEWAY',
      fallbackEnabled: env.otpFallbackEnabled,
      expiresAt,
      meta: { phoneOtpId: created.id }
    }
  });

  return {
    requestId: verification.id,
    provider: 'telegram',
    verificationType: 'code' as const,
    status: 'pending' as const,
    phone: maskPhone(phone),
    expiresInSec: env.otpTtlMinutes * 60,
    fallbackAvailable: false,
    delivery: {
      channel: delivery.channel,
      provider: delivery.provider,
      deliveryStatus: delivery.deliveryStatus,
      devMode: delivery.devMode ?? false
    },
    devOtp: env.isProduction ? undefined : code
  };
};

export const otpService = {
  normalizePhone,

  async requestOtp(payload: { phone: string; purpose: OtpPurpose; ip?: string; userAgent?: string }) {
    const phone = normalizePhone(payload.phone);
    const purpose = purposeToDb[payload.purpose];
    const now = new Date();
    const windowStart = new Date(now.getTime() - otpRequestWindowMs);

    const recentCount = await otpVerificationDelegate.count({
      where: { normalizedPhone: phone, createdAt: { gte: windowStart } }
    });

    if (recentCount >= otpMaxPerPhoneWindow) {
      throw new OtpError('OTP_RATE_LIMITED', 429);
    }

    const existingPending = await otpVerificationDelegate.findFirst({
      where: {
        normalizedPhone: phone,
        purpose,
        status: 'PENDING',
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingPending && now.getTime() - existingPending.createdAt.getTime() < env.otpCooldownSeconds * 1000) {
      if (existingPending.provider === 'PLUSOFON') {
        return { ok: true, data: buildPlusofonStartResponse(existingPending) };
      }
      return { ok: true, throttled: true };
    }

    console.info('[OTP] provider selected', {
      provider: env.otpProvider,
      fallbackProvider: env.otpFallbackProvider,
      fallbackEnabled: env.otpFallbackEnabled,
      phone: maskPhone(phone)
    });

    if (env.otpProvider === 'plusofon') {
      try {
        const plusofonResult = await plusofonOtpProvider.startVerification({
          phone,
          purpose: payload.purpose,
          ip: payload.ip,
          userAgent: payload.userAgent,
          requestId: existingPending?.id ?? 'new'
        });

        const verification = await otpVerificationDelegate.create({
          data: {
            phone: payload.phone,
            normalizedPhone: phone,
            provider: plusofonResult.provider,
            purpose,
            status: 'PENDING',
            externalKey: plusofonResult.externalKey,
            externalPhone: plusofonResult.externalPhone,
            fallbackProvider: env.otpFallbackProvider === 'telegram' ? 'TELEGRAM_GATEWAY' : null,
            fallbackEnabled: env.otpFallbackEnabled,
            expiresAt: new Date(Date.now() + env.plusofonVerificationExpiresSec * 1000),
            ip: payload.ip,
            userAgent: payload.userAgent,
            meta: { deliveryStatus: plusofonResult.deliveryStatus }
          }
        });

        return { ok: true, data: buildPlusofonStartResponse(verification) };
      } catch (error) {
        console.error('[OTP] plusofon provider failed', {
          phone: maskPhone(phone),
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
        });

        if (!(env.otpFallbackEnabled && env.otpFallbackProvider === 'telegram')) {
          throw new OtpError('OTP_PROVIDER_UNAVAILABLE', 502);
        }

        const fallback = await requestClassicOtp(payload);
        return { ok: true, data: fallback, devOtp: fallback.devOtp, delivery: fallback.delivery };
      }
    }

    const fallback = await requestClassicOtp(payload);
    return { ok: true, data: fallback, devOtp: fallback.devOtp, delivery: fallback.delivery };
  },

  async getVerificationStatus(requestId: string) {
    const verification = await otpVerificationDelegate.findUnique({ where: { id: requestId } });
    if (!verification) {
      throw new OtpError('OTP_NOT_FOUND', 404);
    }

    if (verification.status === 'PENDING' && verification.expiresAt && verification.expiresAt < new Date()) {
      const expired = await otpVerificationDelegate.update({
        where: { id: verification.id },
        data: { status: 'EXPIRED' }
      });
      return {
        requestId: expired.id,
        status: mapVerificationStatus(expired.status),
        provider: expired.provider === 'PLUSOFON' ? 'plusofon' : 'telegram'
      };
    }

    return {
      requestId: verification.id,
      status: mapVerificationStatus(verification.status),
      provider: verification.provider === 'PLUSOFON' ? 'plusofon' : 'telegram'
    };
  },

  async verifyOtp(payload: { phone: string; code?: string; purpose: OtpPurpose; requestId?: string }) {
    const phone = normalizePhone(payload.phone);

    if (payload.requestId) {
      const verification = await otpVerificationDelegate.findUnique({ where: { id: payload.requestId } });
      if (!verification) throw new OtpError('OTP_NOT_FOUND', 404);
      if (verification.normalizedPhone !== phone) throw new Error('PHONE_MISMATCH');
      if (verification.status === 'VERIFIED') return { phone };
      if (verification.status === 'EXPIRED') throw new OtpError('OTP_EXPIRED');
      if (verification.provider === 'PLUSOFON') {
        throw new OtpError('OTP_INVALID');
      }
    }

    if (!payload.code) {
      throw new OtpError('OTP_INVALID_PHONE');
    }

    const purpose = purposeToDb[payload.purpose];
    const now = new Date();
    const otp = await prisma.phoneOtp.findFirst({
      where: {
        phone,
        purpose,
        consumedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!otp) throw new Error('OTP_INVALID');
    if (otp.attempts >= otp.maxAttempts) throw new Error('OTP_TOO_MANY');

    const hashed = hashOtpCode(payload.code);
    if (hashed !== otp.codeHash) {
      await prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new Error('OTP_INVALID');
    }

    await prisma.phoneOtp.update({ where: { id: otp.id }, data: { consumedAt: now } });
    const verification = await otpVerificationDelegate.findFirst({
      where: { normalizedPhone: phone, purpose, status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
    if (verification) {
      await otpVerificationDelegate.update({
        where: { id: verification.id },
        data: { status: 'VERIFIED', verifiedAt: now }
      });
    }

    return { phone };
  },

  async markPlusofonVerified(payload: { phone: string; key: string }) {
    const phone = normalizePhone(payload.phone);
    const now = new Date();

    const verification = await otpVerificationDelegate.findFirst({
      where: { externalKey: payload.key },
      orderBy: { createdAt: 'desc' }
    });

    if (!verification) {
      console.warn('[OTP] plusofon webhook verification not found', { phone: maskPhone(phone) });
      return { ok: true, accepted: true };
    }

    if (verification.status === 'VERIFIED') {
      return { ok: true, accepted: true };
    }

    if (verification.status !== 'PENDING') {
      return { ok: true, accepted: true };
    }

    if (verification.expiresAt && verification.expiresAt < now) {
      await otpVerificationDelegate.update({ where: { id: verification.id }, data: { status: 'EXPIRED' } });
      return { ok: true, accepted: true };
    }

    if (verification.normalizedPhone !== phone) {
      console.warn('[OTP] plusofon webhook phone mismatch', {
        requestId: verification.id,
        phone: maskPhone(phone)
      });
      return { ok: true, accepted: true };
    }

    await otpVerificationDelegate.update({
      where: { id: verification.id },
      data: { status: 'VERIFIED', verifiedAt: now }
    });

    console.info('[OTP] verification marked verified', { requestId: verification.id, phone: maskPhone(phone) });
    return { ok: true, accepted: true };
  },

  async updateDeliveryStatus(payload: {
    providerRequestId?: string;
    providerPayload?: string;
    deliveryStatus: OtpDeliveryStatus;
  }) {
    const otpIdFromPayload = typeof payload.providerPayload === 'string' ? payload.providerPayload.trim() : null;
    const otp = payload.providerRequestId
      ? await prisma.phoneOtp.findFirst({ where: { providerRequestId: payload.providerRequestId } })
      : otpIdFromPayload
        ? await prisma.phoneOtp.findUnique({ where: { id: otpIdFromPayload } })
        : null;

    if (!otp) return null;

    return prisma.phoneOtp.update({
      where: { id: otp.id },
      data: {
        deliveryStatus: payload.deliveryStatus,
        providerRequestId: payload.providerRequestId ?? otp.providerRequestId,
        providerPayload: payload.providerPayload ?? undefined
      }
    });
  },

  mapIncomingDeliveryStatus(status: string): OtpDeliveryStatus | null {
    const normalized = status.toLowerCase();
    if (normalized === 'delivered') return 'DELIVERED';
    if (normalized === 'read') return 'READ';
    if (normalized === 'expired') return 'EXPIRED';
    if (normalized === 'revoked') return 'REVOKED';
    if (normalized === 'sent') return 'SENT';
    return null;
  },

  validateTelegramCallbackSignature(payload: {
    timestamp: string;
    signature: string;
    rawBody: string;
  }) {
    const secret =
      env.telegramGatewayCallbackSecret ||
      crypto.createHash('sha256').update(env.telegramGatewayToken).digest('hex');
    const computed = crypto
      .createHmac('sha256', secret)
      .update(`${payload.timestamp}\n${payload.rawBody}`)
      .digest('hex');

    if (computed.length !== payload.signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(payload.signature));
  }
};
