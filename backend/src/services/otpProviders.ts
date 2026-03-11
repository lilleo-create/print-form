import { OtpProvider as PrismaOtpProvider } from '@prisma/client';

export type OtpProviderKind = 'plusofon' | 'telegram' | 'sms' | 'console';

export type StartVerificationInput = {
  phone: string;
  purpose: string;
  ip?: string;
  userAgent?: string;
  requestId: string;
};

export type StartVerificationResult = {
  provider: PrismaOtpProvider;
  verificationType: 'call_to_auth' | 'code';
  externalKey?: string;
  externalPhone?: string;
  deliveryStatus?: 'SENT' | 'DELIVERED' | 'READ' | 'EXPIRED' | 'REVOKED';
};

export interface OtpProvider {
  kind: OtpProviderKind;
  startVerification(input: StartVerificationInput): Promise<StartVerificationResult>;
}
