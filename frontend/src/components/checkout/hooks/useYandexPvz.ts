import { useEffect, useMemo, useState } from 'react';

export type YandexPvzPoint = {
  id: string;
  fullAddress: string;
  position: { lat: number; lng: number };
  type?: string;
  paymentMethods?: string[];
  platformStationId?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const useYandexPvz = ({ city, query, enabled }: { city: string; query: string; enabled: boolean }) => {
  const [points, setPoints] = useState<YandexPvzPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ city });
    if (query.trim()) {
      params.set('query', query.trim());
    }
    return `${API_URL}/api/yandex-delivery/pvz?${params.toString()}`;
  }, [city, query]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetch(endpoint, { signal: controller.signal, credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({ message: 'Не удалось прочитать ответ сервера.' }));
        if (!response.ok) {
          throw new Error(typeof payload?.message === 'string' ? payload.message : `HTTP ${response.status}`);
        }
        const rows: unknown[] = Array.isArray(payload?.points) ? payload.points : [];
        const normalized = rows.filter((row: unknown): row is YandexPvzPoint => {
          if (!row || typeof row !== 'object') return false;
          if (typeof row.id !== 'string' || typeof row.fullAddress !== 'string') return false;
          if (!row.position || typeof row.position !== 'object') return false;
          const { lat, lng } = row.position as { lat?: unknown; lng?: unknown };
          return typeof lat === 'number' && typeof lng === 'number';
        });
        setPoints(normalized);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name === 'AbortError') return;
        setPoints([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить ПВЗ');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [enabled, endpoint]);

  return { points, loading, error };
};
