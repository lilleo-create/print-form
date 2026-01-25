import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { userRepository } from '../repositories/userRepository';

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2),
  phone: z.string().min(5),
  address: z.string().min(5),
  role: z.enum(['BUYER', 'SELLER']).optional()
});

authRoutes.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await authService.register(
      payload.name,
      payload.email,
      payload.password,
      payload.role,
      payload.phone,
      payload.address
    );
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'lax' });
    res.json({
      token: result.accessToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        role: result.user.role,
        email: result.user.email,
        phone: result.user.phone,
        address: result.user.address
      }
    });
  } catch (error) {
    next(error);
  }
});

authRoutes.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await authService.login(payload.email, payload.password);
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'lax' });
    res.json({
      token: result.accessToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        role: result.user.role,
        email: result.user.email,
        phone: result.user.phone,
        address: result.user.address
      }
    });
  } catch (error) {
    next(error);
  }
});

authRoutes.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken as string | undefined;
    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    const result = await authService.refresh(token);
    return res.json({ token: result.accessToken });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken as string | undefined;
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie('refreshToken');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

authRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await userRepository.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    return res.json({
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    return next(error);
  }
});
