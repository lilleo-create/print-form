import { OtpProvider } from '../otpProviders';

export const telegramOtpProvider: OtpProvider = {
  kind: 'telegram',
  async startVerification() {
    throw new Error('OTP_PROVIDER_UNAVAILABLE');
  }
};
