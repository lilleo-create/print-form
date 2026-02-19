import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { YandexNddHttpError } from '../services/yandexNdd/YandexNddClient';

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


  if (error instanceof YandexNddHttpError) {
    if (error.code === 'YANDEX_SMARTCAPTCHA_BLOCK' || error.code === 'YANDEX_IP_BLOCKED') {
      return res.status(503).json({
        error: {
          code: 'YANDEX_IP_BLOCKED',
          details: error.details
        }
      });
    }

    if (error.status === 401) {
      return res.status(401).json({ error: { code: 'NDD_UNAUTHORIZED', details: error.details } });
    }

    const detailsCode =
      error.details && typeof error.details === 'object'
        ? String((error.details as Record<string, unknown>).code ?? '')
        : '';

    if (error.status === 403 && detailsCode === 'no_permissions') {
      return res.status(403).json({ error: { code: 'NDD_NO_PERMISSIONS', details: error.details } });
    }

    return res.status(502).json({
      error: {
        code: error.code,
        status: error.status,
        details: error.details
      }
    });
  }

  const status = error.message === 'INVALID_CREDENTIALS' || error.message === 'UNAUTHORIZED'
    ? 401
    : error.message === 'OTP_TOKEN_REQUIRED'
    ? 401
    : error.message === 'FORBIDDEN' || error.message === 'PHONE_NOT_VERIFIED'
    ? 403
    : error.message === 'USER_EXISTS' || error.message === 'EMAIL_EXISTS' || error.message === 'PHONE_EXISTS'
    ? 409
    : error.message === 'ORDER_NOT_FOUND'
    ? 404
    : error.message === 'OTP_INVALID' ||
      error.message === 'OTP_EXPIRED' ||
      error.message === 'OTP_TOO_MANY' ||
      error.message === 'INVALID_PHONE' ||
      error.message === 'CORS_NOT_ALLOWED' ||
      error.message === 'PHONE_MISMATCH' ||
      error.message === 'KYC_FILE_TYPE_INVALID' ||
      error.message === 'AMOUNT_MISMATCH' ||
      error.message === 'PAYMENT_REQUIRED' ||
      error.message === 'SELLER_DROPOFF_REQUIRED' ||
      error.message === 'SELLER_DROPOFF_PVZ_REQUIRED' ||
      error.message === 'BUYER_PICKUP_REQUIRED' ||
      error.message === 'SELLER_STATION_ID_REQUIRED' ||
      error.message === 'BUYER_STATION_ID_REQUIRED' ||
      error.message === 'VALIDATION_ERROR' ||
      error.message === 'SHIPPING_ADDRESS_REQUIRED' ||
      error.message === 'DELIVERY_DESTINATION_REQUIRED' ||
      error.message === 'DELIVERY_METHOD_NOT_SUPPORTED'
    ? 400
    : error.message === 'ORDER_NOT_PAID' || error.message === 'PICKUP_POINT_REQUIRED'
    ? 409
    : 500;

  if (status === 500) {
    console.error('[errorHandler] unexpected error', {
      message: error.message,
      stack: error.stack
    });
  }

  res.status(status).json({ error: { code: error.message || 'SERVER_ERROR' } });
};
