import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';

export const pickupPointRoutes = Router();

const pickupPoints = [
  {
    id: 'cdek-1',
    provider: 'CDEK',
    address: 'Москва, Поликарпова, 23А к38',
    lat: 55.754,
    lng: 37.556,
    title: 'СДЭК Поликарпова',
    workHours: '09:00–21:00'
  },
  {
    id: 'ya-1',
    provider: 'YANDEX',
    address: 'Москва, Ленинградский проспект, 31',
    lat: 55.782,
    lng: 37.576,
    title: 'Яндекс Маркет ПВЗ',
    workHours: '10:00–22:00'
  }
] as const;

pickupPointRoutes.get('/', requireAuth, (req, res) => {
  const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined;
  const items = provider ? pickupPoints.filter((point) => point.provider === provider) : pickupPoints;
  res.json({ items });
});
