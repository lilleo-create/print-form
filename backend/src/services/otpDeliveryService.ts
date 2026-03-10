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

    if (!payload.callbackUrl.startsWith('https://')) {
      console.warn('[OTP] telegram callback_url is not https; this is acceptable for local dev but external callbacks will not be delivered', {
        callbackUrl: payload.callbackUrl
      });
    }

    if (env.otpProvider === 'telegram') {
      if (!telegramGatewayService.isEnabled()) {
        console.warn('[OTP] telegram provider selected but TELEGRAM_GATEWAY_TOKEN is empty, using dev fallback');
      } else {
        try {
          console.info('[OTP] telegram checkSendAbility:request', {
            phone: payload.phone,
            internalRequestId: payload.requestId
          });
          const ability = await telegramGatewayService.checkSendAbility(payload.phone);
          const telegramRequestId = ability.requestId;
          console.info('[OTP] telegram checkSendAbility:response', {
            phone: payload.phone,
            internalRequestId: payload.requestId,
            telegramRequestId,
            response: ability
          });

          if (!ability.canSend) {
            const reason = ability.reason ?? 'UNKNOWN_REASON';
            const error = new Error(`TELEGRAM_CANNOT_SEND:${reason}`);
            console.error('[OTP] telegram checkSendAbility rejected sending', {
              phone: payload.phone,
              internalRequestId: payload.requestId,
              telegramRequestId,
              reason
            });
            throw error;
          }

          if (!telegramRequestId) {
            throw new Error('TELEGRAM_REQUEST_ID_MISSING');
          }

          console.info('[OTP] telegram sendVerificationMessage:request', {
            phone: payload.phone,
            internalRequestId: payload.requestId,
            telegramRequestId,
            request_id: telegramRequestId,
            callbackUrl: payload.callbackUrl,
            ttlSeconds: payload.ttlSeconds,
            providerPayload: payload.providerPayload
          });
          const sent = await telegramGatewayService.sendVerificationMessage({
            phoneNumber: payload.phone,
            code: payload.code,
            requestId: telegramRequestId,
            ttlSeconds: payload.ttlSeconds,
            callbackUrl: payload.callbackUrl,
            providerPayload: payload.providerPayload
          });
          console.info('[OTP] telegram sendVerificationMessage:response', {
            phone: payload.phone,
            internalRequestId: payload.requestId,
            telegramRequestId,
            response: sent
          });

          if (!sent.ok) {
            throw new Error(`TELEGRAM_SEND_FAILED:${sent.error ?? 'UNKNOWN_ERROR'}`);
          }

          if (!sent.deliveryStatus) {
            throw new Error('TELEGRAM_SEND_FAILED:UNKNOWN_DELIVERY_STATUS');
          }

          return {
            channel: 'TELEGRAM',
            provider: 'TELEGRAM_GATEWAY',
            deliveryStatus: mapStatusToDb(sent.deliveryStatus),
            providerRequestId: sent.providerRequestId ?? telegramRequestId,
            providerPayload:
              typeof sent.providerPayload === 'object' && sent.providerPayload
                ? (sent.providerPayload as Record<string, unknown>)
                : payload.providerPayload
          };
        } catch (error) {
          console.error('[OTP] telegram delivery failed', {
            phone: payload.phone,
            internalRequestId: payload.requestId,
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
