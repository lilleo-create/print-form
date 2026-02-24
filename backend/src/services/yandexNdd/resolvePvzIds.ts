/**
 * Single resolver for PVZ IDs:
 * pickup_point_id (UUID or 32-hex) → platformId (UUID dashed) + operatorStationId (digits)
 */

import { yandexNddClient } from './YandexNddClient';
import type { PickupPointsListResponse, ResolvedPvzIds } from './nddTypes';
import { looksLikeDigits, NddValidationError } from './nddIdSemantics';

/* ------------------------------------------------------------------ */
/* UUID helpers                                                        */
/* ------------------------------------------------------------------ */

const UUID_DASHED_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_HEX32_RE = /^[0-9a-f]{32}$/i;

/**
 * Accept:
 * - dashed UUID (36 chars)
 * - 32-hex UUID (no dashes)
 * Return:
 * - normalized dashed UUID
 */
function normalizeUuid(input: unknown): string | null {
  const s = String(input ?? '').trim();

  if (UUID_DASHED_RE.test(s)) {
    return s.toLowerCase();
  }

  if (UUID_HEX32_RE.test(s)) {
    return (
      s.slice(0, 8) +
      '-' +
      s.slice(8, 12) +
      '-' +
      s.slice(12, 16) +
      '-' +
      s.slice(16, 20) +
      '-' +
      s.slice(20)
    ).toLowerCase();
  }

  return null;
}

function extractPoints(response: unknown): PickupPointsListResponse['points'] {
  const r = response as PickupPointsListResponse;

  if (Array.isArray(r?.points)) return r.points;
  if (Array.isArray(r?.result?.points)) return r.result!.points;

  return [];
}

/* ------------------------------------------------------------------ */
/* Main resolver                                                       */
/* ------------------------------------------------------------------ */

export async function resolvePvzIds(
  pickupPointId: string
): Promise<ResolvedPvzIds> {
  const trimmed = String(pickupPointId ?? '').trim();

  if (!trimmed) {
    throw new NddValidationError('pickupPointId is required.', [
      { field: 'pickupPointId', message: 'empty', value: pickupPointId }
    ]);
  }

  const response = await yandexNddClient.pickupPointsList({
    pickup_point_ids: [trimmed]
  });

  const points = extractPoints(response);

  const point = points?.find(
    (p) =>
      p &&
      typeof p === 'object' &&
      String((p as { id?: string }).id ?? '') === trimmed
  ) as { id?: string; operator_station_id?: string } | undefined;

  if (!point) {
    throw new NddValidationError('PVZ not found in pickup-points/list.', [
      { field: 'pickupPointId', message: 'not_found', value: trimmed }
    ]);
  }

  /* ---------------- platform_id (UUID) ---------------- */

  const rawId = point.id ?? '';
  const platformId = normalizeUuid(rawId);

  if (!platformId) {
    console.warn('[NDD][resolvePvzIds] invalid platformId format', {
      pickupPointId: trimmed,
      rawId
    });

    throw new NddValidationError(
      'PVZ point.id must be UUID (pickup_point_id).',
      [
        {
          field: 'platformId',
          message: 'platform_id must be uuid (dashed or 32-hex)',
          value: rawId
        }
      ]
    );
  }

  /* ---------------- operator_station_id (digits) ---------------- */

  const rawOp = point.operator_station_id ?? '';
  const operatorStationId = String(rawOp).trim();

  if (!looksLikeDigits(operatorStationId)) {
    throw new NddValidationError(
      'PVZ operator_station_id must be digits.',
      [
        {
          field: 'operatorStationId',
          message: 'expected digits',
          value: rawOp
        }
      ]
    );
  }

  console.info('[NDD][resolvePvzIds]', {
    pickupPointId: trimmed,
    platformId,
    operatorStationId,
    shapes: {
      platformId: 'uuid',
      operatorStationId: 'digits'
    }
  });

  return {
    platformId,
    operatorStationId
  };
}