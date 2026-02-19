import { useEffect, useMemo, useState } from 'react';
import type { SellerDropoffStation } from '../shared/api/api';
import { getYmaps, type YmapsReactUi } from '../shared/lib/ymaps3';

type Props = {
  points: SellerDropoffStation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function toCoord(point: SellerDropoffStation) {
  const lat = point.position?.latitude;
  const lon = point.position?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return [lon, lat] as [number, number];
}

export function SellerDropoffMap({ points, selectedId, onSelect }: Props) {
  const [ui, setUi] = useState<YmapsReactUi | null>(null);

  useEffect(() => {
    getYmaps().then(setUi).catch(console.error);
  }, []);

  const coords = useMemo(
    () => points.map(toCoord).filter(Boolean) as [number, number][],
    [points]
  );

  const center = useMemo(() => {
    const selected = points.find((point) => point.id === selectedId);
    const selectedCoord = selected ? toCoord(selected) : null;
    return selectedCoord ?? coords[0] ?? [37.6173, 55.7558];
  }, [points, selectedId, coords]);

  if (!ui) return <div>Загрузка карты…</div>;

  const {
    reactify,
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapMarker
  } = ui;

  return (
    <YMap
      location={reactify.useDefault({ center, zoom: 11 }, [center[0], center[1]])}
      style={{ width: '100%', height: '100%' }}
      mode="vector"
    >
      <YMapDefaultSchemeLayer />
      <YMapDefaultFeaturesLayer />

      {points.map((point) => {
        const coord = toCoord(point);
        if (!coord) return null;

        const active = point.id === selectedId;

        return (
          <YMapMarker key={point.id} coordinates={coord}>
            <button
              type="button"
              aria-label={`Выбрать пункт ${point.name ?? point.id}`}
              onClick={() => onSelect(point.id)}
              style={{
                width: active ? 18 : 14,
                height: active ? 18 : 14,
                borderRadius: 999,
                background: active ? 'black' : '#444',
                border: '2px solid white',
                cursor: 'pointer'
              }}
            />
          </YMapMarker>
        );
      })}
    </YMap>
  );
}
