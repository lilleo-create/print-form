import { Router } from 'express';
import { yandexDeliveryOrchestrator } from '../services/delivery/YandexDeliveryService';

export const nddRoutes = Router();

nddRoutes.get('/pickup-points', async (req, res) => {
  try {
    const city = String(req.query.city ?? '').trim() || 'Москва';
    const bboxByCity: Record<string, { latFrom: number; latTo: number; lonFrom: number; lonTo: number }> = {
      Москва: { latFrom: 55.4, latTo: 56.1, lonFrom: 37.2, lonTo: 38.1 },
      Moscow: { latFrom: 55.4, latTo: 56.1, lonFrom: 37.2, lonTo: 38.1 },
      'Санкт-Петербург': { latFrom: 59.7, latTo: 60.2, lonFrom: 29.7, lonTo: 30.7 },
    };

    const bbox = bboxByCity[city] ?? bboxByCity['Москва'];
    const points = await yandexDeliveryOrchestrator.listPickupPoints({
      is_post_office: false,
      latitude: { from: bbox.latFrom, to: bbox.latTo },
      longitude: { from: bbox.lonFrom, to: bbox.lonTo },
    }, { requestId: String(req.headers['x-request-id'] ?? '') || undefined });

    res.json(points.map((point) => ({
      id: point.pickupPointId,
      address: point.address ?? point.name ?? '',
      lat: point.latitude,
      lon: point.longitude,
      raw: point,
    })));
  } catch (error: any) {
    res.status(error.httpStatus ?? 502).json({
      error: {
        code: error.code ?? 'NDD_REQUEST_FAILED',
        message: error.message,
        details: error.details,
      },
    });
  }
});
