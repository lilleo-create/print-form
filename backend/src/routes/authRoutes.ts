import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2),
  role: z.enum(['BUYER', 'SELLER']).optional()
});

authRoutes.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await authService.register(
      payload.name,
      payload.email,
      payload.password,
      payload.role
    );
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'lax' });
    res.json({
      token: result.accessToken,
      user: { id: result.user.id, name: result.user.name, role: result.user.role }
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
      user: { id: result.user.id, name: result.user.name, role: result.user.role }
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
