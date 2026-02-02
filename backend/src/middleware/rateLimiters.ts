import rateLimit from "express-rate-limit";

const createLimiter = (options: { windowMs: number; max: number }) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED" } },

    // ✅ ВАЖНО: никогда не лимитим preflight
    skip: (req) => req.method === "OPTIONS",
  });

export const globalLimiter = createLimiter({
  windowMs: 5 * 60 * 2000,
  max: 300,
});
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
