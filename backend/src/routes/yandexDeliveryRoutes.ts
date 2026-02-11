import { Router } from 'express';
import { fetchYandexPvz } from '../services/yandexDelivery';

export const yandexDeliveryRoutes = Router();

const isMoscow = (city: string) => /москва/i.test(city);

yandexDeliveryRoutes.get('/pvz', async (req, res, next) => {
  try {
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';

    if (!city) {
      return res.status(400).json({
        message: 'Параметр city обязателен. Для тестовой среды поддерживается только Москва.'
      });
    }

    if (!isMoscow(city)) {
      return res.status(400).json({
        message: 'В тестовой среде Яндекс Доставки поддерживается только город Москва.'
      });
    }

    const points = await fetchYandexPvz({ city, query });

    return res.json({ points });
  } catch (error) {
    next(error);
  }
});
