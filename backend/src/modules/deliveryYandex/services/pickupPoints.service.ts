/**
 * Pickup points: POST /api/b2b/platform/pickup-points/list — request, validate, normalize, log.
 */

import { yandexHttp } from '../api/yandexHttp';
import { ENDPOINTS } from '../api/endpoints';
import {
  yandexPickupPointsListResponseSchema,
  type YandexPickupPointsListRequest,
} from '../domain/schemas';
import type { NormalizedPickupPoint } from '../domain/types';
import type { CorrelationId } from '../domain/types';
import { logDeliveryYandex } from '../logger';
import { normalizePickupPoint } from '../mapper';

export type PickupPointsListRequestDto = YandexPickupPointsListRequest;

export type PickupPointsListResult =
  | { ok: true; points: NormalizedPickupPoint[] }
  | { ok: false; code: string; statusCode: number; message: string; upstreamData?: unknown };

/**
 * Call Yandex pickup-points/list, validate response, normalize to our shape.
 */
export async function listPickupPoints(
  body: PickupPointsListRequestDto,
  requestId?: CorrelationId | string
): Promise<PickupPointsListResult> {
  const start = Date.now();

  const result = await yandexHttp<unknown>({
    path: ENDPOINTS.PICKUP_POINTS_LIST,
    method: 'POST',
    body,
  });

  const durationMs = Date.now() - start;

  if (!result.ok) {
    logDeliveryYandex({
      operation: 'pickupPoints.list',
      requestId: requestId ?? undefined,
      durationMs,
      params: { geo_id: body.geo_id, type: body.type, pickup_point_ids: body.pickup_point_ids?.length },
      result: 'error',
      errorCode: result.error.code,
    });
    return {
      ok: false,
      code: result.error.code,
      statusCode: result.error.statusCode,
      message: result.error.message,
      upstreamData: result.error.upstreamData,
    };
  }

  const parsed = yandexPickupPointsListResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    logDeliveryYandex({
      operation: 'pickupPoints.list',
      requestId: requestId ?? undefined,
      durationMs,
      params: { geo_id: body.geo_id, type: body.type },
      result: 'error',
      errorCode: 'NDD_VALIDATION_ERROR',
    });
    return {
      ok: false,
      code: 'NDD_VALIDATION_ERROR',
      statusCode: 400,
      message: 'Invalid response from Yandex pickup-points/list',
      upstreamData: parsed.error.flatten(),
    };
  }

  const rawPoints = parsed.data.points ?? parsed.data.result?.points ?? [];
  const points: NormalizedPickupPoint[] = [];
  for (let i = 0; i < rawPoints.length; i++) {
    const normalized = normalizePickupPoint(rawPoints[i], i);
    if (normalized) {
      if (normalized.platformStationId === undefined) {
        logDeliveryYandex({
          operation: 'pickupPoints.list',
          requestId: requestId ?? undefined,
          durationMs: 0,
          result: 'ok',
          params: { warning: 'platformStationId_missing', pickupPointId: normalized.pickupPointId },
        });
      }
      points.push(normalized);
    }
  }

  logDeliveryYandex({
    operation: 'pickupPoints.list',
    requestId: requestId ?? undefined,
    durationMs,
    params: { geo_id: body.geo_id, type: body.type, count: points.length },
    result: 'ok',
  });

  return { ok: true, points };
}
