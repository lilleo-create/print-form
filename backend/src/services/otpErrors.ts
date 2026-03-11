export type OtpErrorCode =
  | 'OTP_PROVIDER_UNAVAILABLE'
  | 'OTP_REQUEST_FAILED'
  | 'OTP_INVALID_PHONE'
  | 'OTP_EXPIRED'
  | 'OTP_NOT_FOUND'
  | 'OTP_ALREADY_VERIFIED'
  | 'OTP_RATE_LIMITED'
  | 'OTP_INVALID';

export class OtpError extends Error {
  status: number;

  constructor(code: OtpErrorCode, status = 400) {
    super(code);
    this.status = status;
  }
}
