import { OtpChannel, OtpDeliveryStatus, OtpProvider } from '@prisma/client';
import { env } from '../config/env';
import { smsProvider } from './smsProvider';
import { telegramGatewayService } from './telegramGatewayService';

export type OtpDeliveryResult = {
  channel: OtpChannel;
  provider: OtpProvider;
  deliveryStatus: OtpDeliveryStatus;
  providerRequestId?: string;
  providerPayload?: Record<string, unknown>;
};

const mapStatusToDb = (status: 'sent' | 'delivered' | 'read' | 'expired' | 'revoked'): OtpDeliveryStatus => {
  if (status === 'delivered') return 'DELIVERED';
  if (status === 'read') return 'READ';
  if (status === 'expired') return 'EXPIRED';
  if (status === 'revoked') return 'REVOKED';
  return 'SENT';
};

export const otpDeliveryService = {
  async sendOtp(payload: {
    phone: string;
    code: string;
    ttlSeconds: number;
    message: string;
    requestId: string;
    callbackUrl: string;
    providerPayload: Record<string, unknown>;
  }): Promise<OtpDeliveryResult> {
    if (env.otpProvider === 'telegram' && telegramGatewayService.isEnabled()) {
      try {
        const ability = await telegramGatewayService.checkSendAbility(payload.phone);
        if (ability.canSend) {
          const sent = await telegramGatewayService.sendVerificationMessage({
            phoneNumber: payload.phone,
            code: payload.code,
            requestId: payload.requestId,
            ttlSeconds: payload.ttlSeconds,
            callbackUrl: payload.callbackUrl,
            providerPayload: payload.providerPayload
          });

          return {
            channel: 'TELEGRAM',
            provider: 'TELEGRAM_GATEWAY',
            deliveryStatus: mapStatusToDb(sent.deliveryStatus),
            providerRequestId: sent.providerRequestId,
            providerPayload:
              typeof sent.providerPayload === 'object' && sent.providerPayload
                ? (sent.providerPayload as Record<string, unknown>)
                : payload.providerPayload
          };
        }
      } catch (error) {
        console.warn('[OTP] telegram delivery failed, trying fallback', { error });
      }
    }

    if (env.smsProvider === 'twilio') {
      await smsProvider.sendOtp(payload.phone, payload.message);
      return {
        channel: 'SMS',
        provider: 'TWILIO',
        deliveryStatus: 'SENT'
      };
    }

    await smsProvider.sendOtp(payload.phone, payload.message);
    return {
      channel: 'CONSOLE',
      provider: 'CONSOLE',
      deliveryStatus: 'SENT'
    };
  }
};
