import dotenv from 'dotenv';

dotenv.config();

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const port = Number(process.env.PORT ?? 4000);
if (Number.isNaN(port) || port <= 0) {
  throw new Error('PORT must be a valid number');
}

const jwtSecret = requireEnv('JWT_SECRET');
const jwtRefreshSecret = requireEnv('JWT_REFRESH_SECRET');
const otpPepper = requireEnv('OTP_HASH_PEPPER');

if (jwtSecret.length < 32 || jwtRefreshSecret.length < 32 || otpPepper.length < 32) {
  throw new Error('JWT secrets and OTP_HASH_PEPPER must be at least 32 characters long');
}

const smsProvider = process.env.SMS_PROVIDER ?? 'mock';
if (smsProvider === 'twilio') {
  requireEnv('TWILIO_ACCOUNT_SID');
  requireEnv('TWILIO_AUTH_TOKEN');
  requireEnv('TWILIO_FROM');
}

const otpTtlMinutes = Number(process.env.OTP_TTL_MINUTES ?? 10);
const otpCooldownSeconds = Number(process.env.OTP_COOLDOWN_SECONDS ?? 60);
const otpMaxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

if (
  Number.isNaN(otpTtlMinutes) ||
  Number.isNaN(otpCooldownSeconds) ||
  Number.isNaN(otpMaxAttempts)
) {
  throw new Error('OTP_TTL_MINUTES, OTP_COOLDOWN_SECONDS, OTP_MAX_ATTEMPTS must be numbers');
}

export const env = {
  nodeEnv,
  isProduction,
  port,
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret,
  jwtRefreshSecret,
  frontendUrl: requireEnv('FRONTEND_URL'),
  otpPepper,
  otpTtlMinutes,
  otpCooldownSeconds,
  otpMaxAttempts,
  smsProvider,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioFrom: process.env.TWILIO_FROM ?? '',
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? '',
  googleSheetsId: process.env.GOOGLE_SHEETS_ID ?? '',
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '',
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ?? ''
};
