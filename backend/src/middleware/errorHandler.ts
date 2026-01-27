import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = error instanceof ZodError
    ? 400
    : error.message === 'INVALID_CREDENTIALS' || error.message === 'UNAUTHORIZED'
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
      error.message === 'PHONE_MISMATCH'
    ? 400
    : 500;

  res.status(status).json({ error: { code: error.message || 'SERVER_ERROR' } });
};
