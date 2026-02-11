import { useEffect, useState } from 'react';

export type PvzPoint = {
  id: string;
  address?: { full_address?: string };
  position?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  [k: string]: any;
};

type Bounds = {
  latitude: { from: number; to: number };
  longitude: { from: number; to: number };
};

function makeBounds(lat: number, lon: number, km = 25): Bounds {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    latitude: { from: lat - dLat, to: lat + dLat },
    longitude: { from: lon - dLon, to: lon + dLon }
  };
}

// простой геокодер без ключей: Nominatim (OpenStreetMap)
async function geocodeCity(city: string): Promise<{ lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json();
  if (!data?.[0]) throw new Error('Не смог найти город для карты.');
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

export function usePickupPoints(city: string) {
  const [points, setPoints] = useState<PvzPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const { lat, lon } = await geocodeCity(city);
        const bounds = makeBounds(lat, lon, 35);

        // это тот же backend, куда у тебя ходит виджет
        const res = await fetch('https://widget-pvz.dostavka.yandex.net/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_post_office: false,
            latitude: bounds.latitude,
            longitude: bounds.longitude
          })
        });

        if (!res.ok) throw new Error(`PVZ API error: ${res.status}`);
        const json = await res.json();

        if (!cancelled) setPoints(json?.points ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки ПВЗ.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [city]);

  return { points, loading, error };
}
