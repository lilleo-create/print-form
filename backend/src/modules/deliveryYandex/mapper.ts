/**
 * Normalize Yandex API shapes to our domain types. Pure functions only.
 */

import type { NormalizedPickupPoint, PickupPointId, PlatformStationId, OperatorStationId } from './domain/types';
import type { YandexPickupPointRaw } from './domain/schemas';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS_REGEX = /^\d+$/;

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function asPickupPointId(v: unknown): PickupPointId | null {
  const s = asString(v);
  if (!s || !UUID_REGEX.test(s)) return null;
  return s as PickupPointId;
}

function asPlatformStationId(v: unknown): PlatformStationId | null {
  const s = asString(v);
  if (!s || !DIGITS_REGEX.test(s)) return null;
  return s as PlatformStationId;
}

function asOperatorStationId(v: unknown): OperatorStationId | null {
  const s = asString(v);
  if (!s || !DIGITS_REGEX.test(s)) return null;
  return s as OperatorStationId;
}

/**
 * Normalize one raw point from pickup-points/list to NormalizedPickupPoint.
 * Returns null if id is not a valid UUID. If platformStationId is missing, caller may log warning.
 */
export function normalizePickupPoint(raw: YandexPickupPointRaw, _index: number): NormalizedPickupPoint | null {
  const idRaw = raw.id ?? raw.point_id ?? raw.platform_station_id ?? raw.station_id;
  const pickupPointId = asPickupPointId(idRaw);
  if (!pickupPointId) return null;

  const name = asString(raw.name) ?? asString((raw.address as Record<string, unknown>)?.full_address) ?? asString(raw.address) ?? '';

  const address =
    typeof raw.address === 'object' && raw.address !== null && 'full_address' in (raw.address as Record<string, unknown>)
      ? asString((raw.address as Record<string, unknown>).full_address)
      : asString(raw.address) ?? asString((raw.address as Record<string, unknown>)?.address) ?? undefined;

  const rawAny = raw as Record<string, unknown>;
  const station = rawAny?.station as Record<string, unknown> | undefined;

  const platformStationId =
    asPlatformStationId(raw.platform_station_id) ??
    asPlatformStationId(raw.station_id) ??
    asPlatformStationId(station?.station_id) ??
    asPlatformStationId(station?.id) ??
    null;

  const operatorStationId =
    asOperatorStationId(raw.operator_station_id) ??
    asOperatorStationId(rawAny?.operatorStationId) ??
    asOperatorStationId(station?.operator_station_id) ??
    null;

  const latRaw = (raw as Record<string, unknown>).latitude ?? (raw.location as Record<string, unknown>)?.latitude ?? (raw.geo as Record<string, unknown>)?.lat;
  const lonRaw = (raw as Record<string, unknown>).longitude ?? (raw.location as Record<string, unknown>)?.longitude ?? (raw.geo as Record<string, unknown>)?.lon;
  const latitude = typeof latRaw === 'number' && Number.isFinite(latRaw) ? latRaw : null;
  const longitude = typeof lonRaw === 'number' && Number.isFinite(lonRaw) ? lonRaw : null;

  return {
    pickupPointId,
    name: name || pickupPointId,
    address: address ?? undefined,
    platformStationId: platformStationId ?? undefined,
    operatorStationId: operatorStationId ?? undefined,
    operatorId: undefined,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
  };
}
