import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SHEETS_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_SHEETS_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEETS_SHEET_NAME: z.string().optional()
});

const parsed = envSchema.parse(process.env);

const sheetsConfig = {
  id: parsed.GOOGLE_SHEETS_SPREADSHEET_ID,
  clientEmail: parsed.GOOGLE_SHEETS_CLIENT_EMAIL,
  privateKey: parsed.GOOGLE_SHEETS_PRIVATE_KEY
};

if ([sheetsConfig.id, sheetsConfig.clientEmail, sheetsConfig.privateKey].some(Boolean)) {
  if (!sheetsConfig.id || !sheetsConfig.clientEmail || !sheetsConfig.privateKey) {
    throw new Error('Google Sheets env vars are required when any sheet setting is provided.');
  }
}

export const env = {
  port: parsed.PORT,
  jwtSecret: parsed.JWT_SECRET,
  jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
  frontendOrigin: parsed.FRONTEND_ORIGIN,
  googleSheetsId: sheetsConfig.id ?? '',
  googleServiceAccountEmail: sheetsConfig.clientEmail ?? '',
  googlePrivateKey: (sheetsConfig.privateKey ?? '').replace(/\\n/g, '\n'),
  googleSheetsSheetName: parsed.GOOGLE_SHEETS_SHEET_NAME ?? 'Orders'
};
