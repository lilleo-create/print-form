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
  devMode?: boolean;
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
    console.info('[OTP] delivery config', {
      otpProvider: env.otpProvider,
      hasTelegramGatewayToken: Boolean(env.telegramGatewayToken),
      telegramGatewayBaseUrl: env.telegramGatewayBaseUrl,
      smsProvider: env.smsProvider
    });

    if (env.otpProvider === 'telegram') {
      if (!telegramGatewayService.isEnabled()) {
        console.warn('[OTP] telegram provider selected but TELEGRAM_GATEWAY_TOKEN is empty, using dev fallback');
      } else {
        try {
          console.info('[OTP] telegram checkSendAbility:request', {
            phone: payload.phone,
            requestId: payload.requestId
          });
          const ability = await telegramGatewayService.checkSendAbility(payload.phone);
          console.info('[OTP] telegram checkSendAbility:response', {
            phone: payload.phone,
            requestId: payload.requestId,
            response: ability
          });

          if (!ability.canSend) {
            const reason = ability.reason ?? 'UNKNOWN_REASON';
            const error = new Error(`TELEGRAM_CANNOT_SEND:${reason}`);
            console.error('[OTP] telegram checkSendAbility rejected sending', {
              phone: payload.phone,
              requestId: payload.requestId,
              reason
            });
            throw error;
          }

          console.info('[OTP] telegram sendVerificationMessage:request', {
            phone: payload.phone,
            requestId: payload.requestId,
            callbackUrl: payload.callbackUrl,
            ttlSeconds: payload.ttlSeconds,
            providerPayload: payload.providerPayload
          });
          const sent = await telegramGatewayService.sendVerificationMessage({
            phoneNumber: payload.phone,
            code: payload.code,
            requestId: payload.requestId,
            ttlSeconds: payload.ttlSeconds,
            callbackUrl: payload.callbackUrl,
            providerPayload: payload.providerPayload
          });
          console.info('[OTP] telegram sendVerificationMessage:response', {
            phone: payload.phone,
            requestId: payload.requestId,
            response: sent
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
        } catch (error) {
          console.error('[OTP] telegram delivery failed', {
            phone: payload.phone,
            requestId: payload.requestId,
            error
          });
          if (error instanceof Error && error.message.startsWith('TELEGRAM_')) {
            throw error;
          }
          throw new Error(`TELEGRAM_SEND_FAILED:${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`);
        }
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
      deliveryStatus: 'SENT',
      devMode: true
    };
  }
};
