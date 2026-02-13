export function normalizeArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];

    // иногда бек отдает "categories", "products", etc.
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }

  return [];
}
