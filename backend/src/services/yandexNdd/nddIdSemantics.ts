/**
 * NDD ID semantics:
 * - platform_id / pickup_point_id: UUID (dashed 36) or sometimes 32-hex (needs normalization)
 * - operator_station_id / station_id: digits
 */

export const UUID_DASHED_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UUID_HEX32_RE = /^[0-9a-f]{32}$/i;

export function normalizeUuid(input: unknown): string | null {
  const s = String(input ?? '').trim();
  if (!s) return null;

  if (UUID_DASHED_RE.test(s)) return s.toLowerCase();

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

export function isUuid(input: unknown): boolean {
  return normalizeUuid(input) != null;
}

export function looksLikeDigits(input: unknown): boolean {
  return /^[0-9]+$/.test(String(input ?? '').trim());
}

export function normalizeDigitsStation(input: unknown): string | null {
  const s = String(input ?? '').trim();
  if (!s) return null;
  return looksLikeDigits(s) ? s : null;
}

export function isDigitsStationId(input: unknown): boolean {
  return looksLikeDigits(input);
}

export function looksLikePvzId(input: unknown): boolean {
  const s = String(input ?? '').trim();
  if (!s) return false;
  return UUID_DASHED_RE.test(s) || UUID_HEX32_RE.test(s);
}

export class NddValidationError extends Error {
  public issues: Array<{ field: string; message: string; value?: unknown }>;

  constructor(
    message: string,
    issues: Array<{ field: string; message: string; value?: unknown }> = []
  ) {
    super(message);
    this.name = 'NddValidationError';
    this.issues = issues;
  }
}

export function assertPlatformIdUuid(value: unknown, field: string): string {
  const normalized = normalizeUuid(value);
  if (!normalized) {
    throw new NddValidationError(`${field} must be UUID (platform_id / pickup_point_id).`, [
      { field, message: 'invalid uuid', value }
    ]);
  }
  return normalized;
}

export function assertOperatorStationIdDigits(value: unknown, field: string): string {
  const normalized = normalizeDigitsStation(value);
  if (!normalized) {
    throw new NddValidationError(`${field} must be digits (operator_station_id / station_id).`, [
      { field, message: 'expected digits', value }
    ]);
  }
  return normalized;
}
export function assertStationAndPvzPair(stationIdDigits: unknown, selfPickupId: unknown) {
  const station = typeof stationIdDigits === "string" ? stationIdDigits.trim() : String(stationIdDigits ?? "").trim();
  const pvz = typeof selfPickupId === "string" ? selfPickupId.trim() : String(selfPickupId ?? "").trim();

  if (!station || !isDigitsStationId(station)) {
    throw new Error(`Invalid station_id (digits): ${station}`);
  }
  if (!pvz || !isUuid(pvz)) {
    throw new Error(`Invalid self_pickup_id (uuid): ${pvz}`);
  }
}