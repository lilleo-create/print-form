import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import type { PickupPoint } from '../api/checkoutApi';
import { useYandexPvz, type YandexPvzPoint } from '../../../components/checkout/hooks/useYandexPvz';
import styles from './DeliveryPickupWidget.module.css';

type Props = {
  city?: string;
  isOpen: boolean;
  selectedPoint?: PickupPoint | null;
  onSelected: (point: PickupPoint) => void;
};

const DEFAULT_CENTER = { lat: 55.7558, lng: 37.6176 };

const InvalidateMapSize = () => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
};

const toPickupPoint = (point: YandexPvzPoint): PickupPoint => ({
  id: point.id,
  fullAddress: point.fullAddress,
  position: {
    lat: point.position.lat,
    lng: point.position.lng
  },
  type: point.type,
  paymentMethods: point.paymentMethods
});

export const DeliveryPickupWidget = ({ city = 'Москва', isOpen, selectedPoint, onSelected }: Props) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { points, loading, error } = useYandexPvz({ city, query: debouncedSearch, enabled: isOpen });

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setDebouncedSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const center = useMemo(() => {
    const selectedLat = selectedPoint?.position?.lat;
    const selectedLng = selectedPoint?.position?.lng;
    if (typeof selectedLat === 'number' && typeof selectedLng === 'number') {
      return { lat: selectedLat, lng: selectedLng };
    }

    const firstPoint = points[0];
    if (firstPoint) {
      return firstPoint.position;
    }

    return DEFAULT_CENTER;
  }, [points, selectedPoint?.position?.lat, selectedPoint?.position?.lng]);

  if (!isOpen) {
    return null;
  }

  return (
    <section className={styles.widget}>
      <input
        className={styles.search}
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Поиск по адресу"
      />

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.layout}>
        <div className={styles.list}>
          {loading ? <p className={styles.muted}>Загрузка ПВЗ…</p> : null}
          {!loading && !points.length ? <p className={styles.muted}>Пункты выдачи не найдены.</p> : null}

          {points.map((point) => {
            const isActive = selectedPoint?.id === point.id;
            return (
              <button
                key={point.id}
                type="button"
                className={isActive ? `${styles.listItem} ${styles.listItemActive}` : styles.listItem}
                onClick={() => onSelected(toPickupPoint(point))}
              >
                <span className={styles.address}>{point.fullAddress}</span>
                <span className={styles.meta}>{point.type ?? 'pickup_point'}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.mapContainer}>
          <MapContainer center={center} zoom={11} className={styles.map} scrollWheelZoom>
            <InvalidateMapSize />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {points.map((point) => (
              <Marker
                key={point.id}
                position={point.position}
                eventHandlers={{
                  click: () => onSelected(toPickupPoint(point))
                }}
              >
                <Popup>{point.fullAddress}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <p className={styles.counter}>Найдено точек: {points.length}</p>
    </section>
  );
};
