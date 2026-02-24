/**
 * Controller for pickup points. GET (by city) or POST (raw body) -> normalized points.
 */

import type { Request, Response, NextFunction } from 'express';
import { listPickupPoints } from '../services/pickupPoints.service';
import type { PickupPointsListRequestDto } from '../services/pickupPoints.service';

const BBOX_BY_CITY: Record<string, { latFrom: number; latTo: number; lonFrom: number; lonTo: number }> = {
  Москва: { latFrom: 55.4, latTo: 56.1, lonFrom: 37.2, lonTo: 38.1 },
  Moscow: { latFrom: 55.4, latTo: 56.1, lonFrom: 37.2, lonTo: 38.1 },
  'Санкт-Петербург': { latFrom: 59.7, latTo: 60.2, lonFrom: 29.7, lonTo: 30.7 },
  'Saint Petersburg': { latFrom: 59.7, latTo: 60.2, lonFrom: 29.7, lonTo: 30.7 },
};

/** GET /delivery/pickup-points?city=Москва — returns normalized points for bbox of city */
export async function getPickupPointsByCity(req: Request, res: Response, next: NextFunction): Promise<void> {
  const city = String(req.query.city ?? '').trim() || 'Москва';
  const bbox = BBOX_BY_CITY[city] ?? BBOX_BY_CITY['Москва'];

  const body: PickupPointsListRequestDto = {
    is_post_office: false,
    latitude: { from: bbox.latFrom, to: bbox.latTo },
    longitude: { from: bbox.lonFrom, to: bbox.lonTo },
  };

  const requestId = (req.headers['x-request-id'] as string) ?? undefined;
  const result = await listPickupPoints(body, requestId);

  if (!result.ok) {
    res.status(result.statusCode).json({
      error: {
        code: result.code,
        message: result.message,
        ...(result.upstreamData ? { upstreamData: result.upstreamData } : {}),
      },
    });
    return;
  }

  res.json({
    points: result.points.map((p) => ({
      ...p,
      id: p.pickupPointId,
    })),
  });
}

/** POST /delivery/pickup-points — body as Yandex API (pickup_point_ids, geo_id, type, latitude/longitude) */
export async function postPickupPointsList(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body as PickupPointsListRequestDto;
  const requestId = (req.headers['x-request-id'] as string) ?? undefined;

  const result = await listPickupPoints(body, requestId);

  if (!result.ok) {
    res.status(result.statusCode).json({
      error: {
        code: result.code,
        message: result.message,
        ...(result.upstreamData ? { upstreamData: result.upstreamData } : {}),
      },
    });
    return;
  }

  res.json({
    points: result.points.map((p) => ({
      ...p,
      id: p.pickupPointId,
    })),
  });
}
