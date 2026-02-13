import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { generateOtpCode, hashOtpCode } from '../utils/otp';
import { normalizePhone } from '../utils/phone';
import { smsProvider } from './smsProvider';

const otpRequestWindowMs = 15 * 60 * 1000;
const otpMaxPerPhoneWindow = 3;

export type OtpPurpose = 'login' | 'register' | 'seller_verify' | 'password_reset';

const formatPurpose = (purpose: OtpPurpose) => {
  switch (purpose) {
    case 'seller_verify':
      return 'подтверждения телефона продавца';
    case 'register':
      return 'регистрации';
    case 'password_reset':
      return 'сброса пароля';
    default:
      return 'входа';
  }
};

export const otpService = {
  normalizePhone,
  async requestOtp(payload: { phone: string; purpose: OtpPurpose; ip?: string; userAgent?: string }) {
    const phone = normalizePhone(payload.phone);
    const purpose = payload.purpose.toUpperCase() as 'LOGIN' | 'REGISTER' | 'SELLER_VERIFY' | 'PASSWORD_RESET';
    const now = new Date();
    const windowStart = new Date(now.getTime() - otpRequestWindowMs);
    const recentCount = await prisma.phoneOtp.count({
      where: {
        phone,
        purpose,
        createdAt: { gte: windowStart }
      }
    });

    if (recentCount >= otpMaxPerPhoneWindow) {
      return { ok: true, throttled: true };
    }

    const lastOtp = await prisma.phoneOtp.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' }
    });

    if (lastOtp && now.getTime() - lastOtp.createdAt.getTime() < env.otpCooldownSeconds * 1000) {
      return { ok: true, throttled: true };
    }

    const code = generateOtpCode();
    await prisma.phoneOtp.create({
      data: {
        phone,
        purpose,
        codeHash: hashOtpCode(code),
        expiresAt: new Date(now.getTime() + env.otpTtlMinutes * 60 * 1000),
        maxAttempts: env.otpMaxAttempts,
        ip: payload.ip,
        userAgent: payload.userAgent
      }
    });

    const message = `Ваш код для ${formatPurpose(payload.purpose)}: ${code}`;
    console.info(`[OTP] request`, { phone, purpose: payload.purpose });
    if (env.isProduction) {
      await smsProvider.sendOtp(phone, message);
    } else {
      console.log(`[OTP] ${phone}: ${message}`);
    }

    return { ok: true, devOtp: env.isProduction ? undefined : code };
  },
  async verifyOtp(payload: { phone: string; code: string; purpose: OtpPurpose }) {
    const phone = normalizePhone(payload.phone);
    const purpose = payload.purpose.toUpperCase() as 'LOGIN' | 'REGISTER' | 'SELLER_VERIFY' | 'PASSWORD_RESET';
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

    if (!otp) {
      throw new Error('OTP_INVALID');
    }
    if (otp.attempts >= otp.maxAttempts) {
      throw new Error('OTP_TOO_MANY');
    }

    const hashed = hashOtpCode(payload.code);
    if (hashed !== otp.codeHash) {
      await prisma.phoneOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } }
      });
      console.info(`[OTP] verify_failed`, { phone, purpose: payload.purpose });
      throw new Error('OTP_INVALID');
    }

    await prisma.phoneOtp.update({
      where: { id: otp.id },
      data: { consumedAt: now }
    });
    console.info(`[OTP] verified`, { phone, purpose: payload.purpose });

    return { phone };
  }
};
