import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { userRepository } from '../repositories/userRepository';

const createAccessToken = (payload: { userId: string; role: string }) => {
  return jwt.sign({ ...payload, scope: 'access' }, env.jwtSecret, { expiresIn: '15m' });
};

const createRefreshToken = (payload: { userId: string; role: string }) => {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: '7d' });
};

const createOtpToken = (payload: { userId: string }) => {
  return jwt.sign({ ...payload, scope: 'otp' }, env.jwtSecret, { expiresIn: '10m' });
};

export const authService = {
  async issueTokens(user: { id: string; role: string }) {
    const accessToken = createAccessToken({ userId: user.id, role: user.role });
    const refreshToken = createRefreshToken({ userId: user.id, role: user.role });
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    return { accessToken, refreshToken };
  },
  issueOtpToken(user: { id: string }) {
    return createOtpToken({ userId: user.id });
  },
  async register(
    name: string,
    email: string,
    password: string,
    role?: 'BUYER' | 'SELLER',
    phone?: string,
    address?: string
  ) {
    const existingEmail = await userRepository.findByEmail(email);
    if (existingEmail) {
      throw new Error('USER_EXISTS');
    }
    if (phone) {
      const existingPhone = await userRepository.findByPhone(phone);
      if (existingPhone) {
        throw new Error('PHONE_EXISTS');
      }
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await userRepository.create({
      name,
      email,
      passwordHash: hashed,
      role,
      phone: phone ?? null,
      address: address ?? null
    });
    return { user };
  },
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('INVALID_CREDENTIALS');
    }
    return { user };
  },
  async refresh(token: string) {
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored) {
      throw new Error('INVALID_REFRESH');
    }
    const decoded = jwt.verify(token, env.jwtRefreshSecret) as { userId: string; role: string };
    const accessToken = createAccessToken({ userId: decoded.userId, role: decoded.role });
    return { accessToken };
  },
  async logout(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }
};
