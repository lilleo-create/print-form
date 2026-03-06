import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

const mapMulterErrorCode = (code: string) => {
  switch (code) {
    case 'LIMIT_FILE_SIZE':
      return 'RETURN_UPLOAD_FILE_TOO_LARGE';
    case 'LIMIT_FILE_COUNT':
      return 'RETURN_UPLOAD_TOO_MANY_FILES';
    default:
      return 'RETURN_UPLOAD_FILE_TYPE_INVALID';
  }
};

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        issues: error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message
        }))
      }
    });
  }

  if (error instanceof MulterError) {
    return res.status(400).json({ error: { code: mapMulterErrorCode(error.code) } });
  }

  if (error.message === 'RETURN_UPLOAD_FILE_TYPE_INVALID') {
    return res.status(400).json({ error: { code: 'RETURN_UPLOAD_FILE_TYPE_INVALID' } });
  }

  const extError = error as Error & {
    status?: number;
    code?: string;
    details?: unknown;
    issues?: unknown[];
  };

  if (typeof extError.code === 'string' && extError.code.startsWith('NDD_')) {
    return res.status(extError.status ?? 502).json({
      error: {
        code: extError.code,
        details: extError.details ?? null,
        ...(extError.issues?.length ? { issues: extError.issues } : {})
      }
    });
  }

  const normalizedCode = String(extError.code ?? error.message ?? '').trim();

  const status = normalizedCode === 'INVALID_CREDENTIALS' || normalizedCode === 'UNAUTHORIZED'
    ? 401
    : normalizedCode === 'OTP_TOKEN_REQUIRED'
    ? 401
    : normalizedCode === 'FORBIDDEN' || normalizedCode === 'PHONE_NOT_VERIFIED'
    ? 403
    : normalizedCode === 'USER_EXISTS' || normalizedCode === 'EMAIL_EXISTS' || normalizedCode === 'PHONE_EXISTS'
    ? 409
    : normalizedCode === 'ORDER_NOT_FOUND'
    ? 404
    : normalizedCode === 'OTP_INVALID' ||
      normalizedCode === 'OTP_EXPIRED' ||
      normalizedCode === 'OTP_TOO_MANY' ||
      normalizedCode === 'INVALID_PHONE' ||
      normalizedCode === 'CORS_NOT_ALLOWED' ||
      normalizedCode === 'PHONE_MISMATCH' ||
      normalizedCode === 'KYC_FILE_TYPE_INVALID' ||
      normalizedCode === 'AMOUNT_MISMATCH' ||
      normalizedCode === 'PAYMENT_REQUIRED' ||
      normalizedCode === 'SELLER_DROPOFF_REQUIRED' ||
      normalizedCode === 'SELLER_DROPOFF_PVZ_REQUIRED' ||
      normalizedCode === 'BUYER_PICKUP_REQUIRED' ||
      normalizedCode === 'BUYER_PVZ_REQUIRED' ||
      normalizedCode === 'SELLER_STATION_ID_REQUIRED' ||
      normalizedCode === 'BUYER_STATION_ID_REQUIRED' ||
      normalizedCode === 'ORDER_DELIVERY_OFFER_FAILED' ||
      normalizedCode === 'VALIDATION_ERROR' ||
      normalizedCode === 'SHIPPING_ADDRESS_REQUIRED' ||
      normalizedCode === 'DELIVERY_DESTINATION_REQUIRED' ||
      normalizedCode === 'DELIVERY_METHOD_NOT_SUPPORTED' ||
      normalizedCode === 'CDEK_TARIFF_UNAVAILABLE'
    ? 400
    : normalizedCode === 'ORDER_NOT_PAID' || normalizedCode === 'PICKUP_POINT_REQUIRED'
    ? 409
    : 500;

  if (status === 500) {
    console.error('[errorHandler] unexpected error', {
      message: error.message,
      stack: error.stack
    });
  }

  res.status(status).json({
    error: {
      code: extError.code || error.message || 'SERVER_ERROR',
      message: error.message || 'Unexpected server error'
    }
  });
};
