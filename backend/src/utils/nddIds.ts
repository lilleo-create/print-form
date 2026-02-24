const UUID_DASHED_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_HEX32_RE = /^[0-9a-f]{32}$/i;

export function normalizeUuid(input: unknown): string | null {
  const s = String(input ?? '').trim();

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

export function isDigits(input: unknown): boolean {
  return /^[0-9]+$/.test(String(input ?? '').trim());
}