import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  googleSheetsId: process.env.GOOGLE_SHEETS_ID ?? '',
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '',
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ?? ''
};
