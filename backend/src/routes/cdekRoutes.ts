import { Router } from 'express';
import { getCdekConfig } from '../config/cdek';
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

cdekRoutes.all('/service', async (req, res, next) => {
  try {
    const config = getCdekConfig();
    const token = await cdekService.getToken();

    const cdekPath = String(req.query.path ?? req.body?.path ?? '');
    const method = req.method === 'GET' ? 'GET' : 'POST';
    const cdekUrl = `${config.baseUrl}/v2/${cdekPath}`;

    const response = await fetch(cdekUrl, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: method === 'POST' && req.body ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    next(error);
  }
});
