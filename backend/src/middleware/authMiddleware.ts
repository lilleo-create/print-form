import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { userId: string; role: string };
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    return next();
  };
};
