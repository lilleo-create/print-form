import { OtpProvider } from '../otpProviders';
import { plusofonClient } from '../plusofonClient';
import { env } from '../../config/env';

const maskedPhone = (phone: string) => phone.replace(/.(?=.{4})/g, '*');
const maskedKey = (key: string) => `${key.slice(0, 4)}***${key.slice(-2)}`;

const isLocalWebhookUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0';
  } catch {
    return false;
  }
};

const buildWebhookUrl = () => {
  const base = env.plusofonWebhookPublicUrl || `${env.backendUrl.replace(/\/$/, '')}/auth/otp/plusofon/webhook`;
  const url = new URL(base);
  if (env.plusofonWebhookSecret) {
    url.searchParams.set('token', env.plusofonWebhookSecret);
  }
  return url.toString();
};

export const plusofonOtpProvider: OtpProvider = {
  kind: 'plusofon',
  async startVerification(input) {
    const hookUrl = buildWebhookUrl();
    if (isLocalWebhookUrl(hookUrl)) {
      console.warn('[OTP] plusofon webhook url is local and unreachable from Plusofon', {
        hookUrl,
        plusofonWebhookPublicUrl: env.plusofonWebhookPublicUrl || null
      });
    }

    console.info('[OTP] plusofon callToAuth request', {
      phone: maskedPhone(input.phone),
      requestId: input.requestId,
      hookUrl
    });
    const created = await plusofonClient.createReverseFlashCall({
      phone: input.phone,
      hookUrl
    });

    console.info('[OTP] plusofon callToAuth response', {
      phone: maskedPhone(input.phone),
      requestId: input.requestId,
      key: maskedKey(created.key)
    });

    return {
      provider: 'PLUSOFON',
      verificationType: 'call_to_auth',
      externalKey: created.key,
      externalPhone: created.phone,
      deliveryStatus: 'SENT'
    };
  }
};
