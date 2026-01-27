import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  }
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      userId: string;
      role: string;
      scope?: string;
    };
    if (decoded.scope && decoded.scope !== 'access') {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
    }
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  }
};

export interface OtpAuthRequest extends Request {
  otp?: { userId: string };
}

export const authenticateOtp = (req: OtpAuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: { code: 'OTP_TOKEN_REQUIRED' } });
  }
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { userId: string; scope?: string };
    if (decoded.scope !== 'otp') {
      return res.status(401).json({ error: { code: 'OTP_TOKEN_REQUIRED' } });
    }
    req.otp = { userId: decoded.userId };
    return next();
  } catch {
    return res.status(401).json({ error: { code: 'OTP_TOKEN_REQUIRED' } });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }
    return next();
  };
};
