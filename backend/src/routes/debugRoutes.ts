import { Router } from 'express';

export const debugRoutes = Router();

debugRoutes.post('/ndd/offers', (_req, res) => {
  return res.status(410).json({
    error: {
      code: 'YANDEX_DISABLED',
      message: 'Debug route отключен: интеграция Яндекс/NDD больше не поддерживается.'
    }
  });
});
