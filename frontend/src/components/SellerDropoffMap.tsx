import React, { useEffect, useMemo, useState } from 'react';
import type { SellerDropoffStation } from '../shared/api/api';
import { getYmaps, type YmapsReactUi } from '../shared/lib/ymaps3';

type Props = {
  points: SellerDropoffStation[];
  selectedId: string | null;
  preferredCenter?: [number, number] | null;
  onSelect: (id: string) => void;
};

function toCoord(point: SellerDropoffStation) {
  const lat = point.position?.latitude;
  const lon = point.position?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return [lon, lat] as [number, number];
}

const getSelectableId = (point: SellerDropoffStation): string | null => point.pvzId ?? point.id ?? null;

const averageCenter = (coords: [number, number][]): [number, number] | null => {
  if (!coords.length) return null;
  const [lonSum, latSum] = coords.reduce<[number, number]>((acc, item) => [acc[0] + item[0], acc[1] + item[1]], [0, 0]);
  return [lonSum / coords.length, latSum / coords.length];
};

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Ошибка карты. Список пунктов продолжает работать.</div>;
    }
    return this.props.children;
  }
}

function SellerDropoffMapInner({ points, selectedId, onSelect, preferredCenter }: Props) {
  const [ui, setUi] = useState<YmapsReactUi | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getYmaps()
      .then((mapsUi) => {
        if (!alive) return;
        setUi(mapsUi);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const msg = String((e as { message?: string })?.message || e);
        if (msg.includes('YMAPS_KEY_MISSING')) {
          setErrorText('Нет VITE_YMAPS_API_KEY. Добавьте его в frontend .env и перезапустите Vite.');
          return;
        }
        setErrorText(`Карта не загрузилась: ${msg}`);
      });

    return () => {
      alive = false;
    };
  }, []);

  const coords = useMemo(
    () => points.map(toCoord).filter(Boolean) as [number, number][],
    [points]
  );

  const center = useMemo(() => {
    const selected = points.find((point) => getSelectableId(point) === selectedId);
    const selectedCoord = selected ? toCoord(selected) : null;
    return selectedCoord ?? preferredCenter ?? averageCenter(coords) ?? [37.6173, 55.7558];
  }, [points, selectedId, coords, preferredCenter]);

  if (errorText) return <div>{errorText}</div>;
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
      location={reactify.useDefault({ center, zoom: preferredCenter ? 12 : 11 }, [center[0], center[1], preferredCenter ? 12 : 11])}
      style={{ width: '100%', height: '100%' }}
      mode="vector"
    >
      <YMapDefaultSchemeLayer />
      <YMapDefaultFeaturesLayer />

      {points.map((point) => {
        const coord = toCoord(point);
        if (!coord) return null;
        const selectableId = getSelectableId(point);
        const markerKey = selectableId ?? `${coord[0]}-${coord[1]}`;

        const active = selectableId === selectedId;

        return (
          <YMapMarker key={markerKey} coordinates={coord}>
            <div style={{ pointerEvents: 'auto', transform: 'translate(-50%, -50%)' }}>
              <button
                type="button"
                aria-label={`Выбрать пункт ${point.name ?? selectableId ?? 'без id'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectableId) return;
                  onSelect(selectableId);
                }}
                style={{
                  width: active ? 18 : 14,
                  height: active ? 18 : 14,
                  borderRadius: 999,
                  background: 'black',
                  border: '2px solid white',
                  cursor: 'pointer'
                }}
              />
            </div>
          </YMapMarker>
        );
      })}
    </YMap>
  );
}

export function SellerDropoffMap(props: Props) {
  return (
    <MapErrorBoundary>
      <SellerDropoffMapInner {...props} />
    </MapErrorBoundary>
  );
}
