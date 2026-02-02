import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const createLimiter = (options: { windowMs: number; max: number }) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED' } },
    skip: (req) => req.method === 'OPTIONS' || req.path === '/health'
  });

const globalMax = env.isProduction ? 200 : 1000;
export const globalLimiter = createLimiter({ windowMs: 5 * 60 * 1000, max: globalMax });
export const authLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
export const otpRequestLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});
export const otpVerifyLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});
export const writeLimiter = createLimiter({ windowMs: 5 * 60 * 1000, max: 60 });
