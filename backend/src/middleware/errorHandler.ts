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

  const status = error.message === 'INVALID_CREDENTIALS' || error.message === 'UNAUTHORIZED'
    ? 401
    : error.message === 'OTP_TOKEN_REQUIRED'
    ? 401
    : error.message === 'FORBIDDEN' || error.message === 'PHONE_NOT_VERIFIED'
    ? 403
    : error.message === 'USER_EXISTS' || error.message === 'EMAIL_EXISTS' || error.message === 'PHONE_EXISTS'
    ? 409
    : error.message === 'OTP_INVALID' ||
      error.message === 'OTP_EXPIRED' ||
      error.message === 'OTP_TOO_MANY' ||
      error.message === 'INVALID_PHONE' ||
      error.message === 'CORS_NOT_ALLOWED' ||
      error.message === 'PHONE_MISMATCH' ||
      error.message === 'KYC_FILE_TYPE_INVALID' ||
      error.message === 'AMOUNT_MISMATCH'
    ? 400
    : 500;

  res.status(status).json({ error: { code: error.message || 'SERVER_ERROR' } });
};
