import { NextFunction, Request, Response } from 'express';

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = error.message === 'INVALID_CREDENTIALS' || error.message === 'UNAUTHORIZED'
    ? 401
    : error.message === 'FORBIDDEN'
    ? 403
    : error.message === 'USER_EXISTS'
    ? 409
    : 500;

  res.status(status).json({ error: { code: error.message || 'SERVER_ERROR' } });
};
