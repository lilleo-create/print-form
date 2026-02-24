import { Router } from 'express';
import { cdekService } from '../services/cdekService';

export const cdekRoutes = Router();

cdekRoutes.get('/pickup-points', async (req, res) => {
  try {
    const cityCodeRaw = req.query.cityCode;
    const cityRaw = req.query.city;
    const cityCode = cityCodeRaw !== undefined ? Number(cityCodeRaw) : undefined;
    const city = cityRaw !== undefined ? String(cityRaw) : undefined;

    const points = await cdekService.getPickupPoints(
      Number.isFinite(cityCode) ? cityCode : undefined,
      city
    );

    res.json(points);
  } catch (error: any) {
    res.status(error?.response?.status ?? 502).json({
      error: {
        code: error?.response?.data?.code ?? 'CDEK_REQUEST_FAILED',
        message: error?.response?.data?.message ?? error?.message ?? 'CDEK request failed',
        details: error?.response?.data ?? null
      }
    });
  }
});

cdekRoutes.post('/calculate', async (req, res) => {
  try {
    const { fromCityCode, toCityCode, weightGrams, lengthCm, widthCm, heightCm } = req.body ?? {};

    const result = await cdekService.calculateDelivery({
      fromCityCode: Number(fromCityCode),
      toCityCode: Number(toCityCode),
      weightGrams: Number(weightGrams),
      lengthCm: lengthCm !== undefined ? Number(lengthCm) : undefined,
      widthCm: widthCm !== undefined ? Number(widthCm) : undefined,
      heightCm: heightCm !== undefined ? Number(heightCm) : undefined
    });

    res.json(result);
  } catch (error: any) {
    res.status(error?.response?.status ?? 502).json({
      error: {
        code: error?.response?.data?.code ?? 'CDEK_REQUEST_FAILED',
        message: error?.response?.data?.message ?? error?.message ?? 'CDEK request failed',
        details: error?.response?.data ?? null
      }
    });
  }
});
