import { useEffect, useRef, useState } from 'react';
import type { PickupPointDto } from '../api/checkoutApi';
import { safeLoadYmaps } from '../../../shared/lib/safeLoadYmaps';
import styles from './PickupMap.module.css';

type Props = {
  points: PickupPointDto[];
  selectedId?: string;
  center: { lat: number; lng: number };
  isLoading: boolean;
  onSelect: (id: string) => void;
};

type YMapInstance = {
  setBounds: (bounds: number[][], options?: Record<string, unknown>) => void;
  setCenter: (coords: number[], zoom?: number) => void;
  behaviors: { disable: (name: string) => void };
  geoObjects: {
    add: (object: unknown) => void;
    removeAll: () => void;
  };
  destroy: () => void;
};

type YPlacemark = {
  events: { add: (event: string, cb: () => void) => void };
  options: { set: (key: string, value: unknown) => void };
};

type YClusterer = {
  add: (items: unknown[]) => void;
  removeAll: () => void;
  getBounds: () => number[][] | null;
};

const defaultIcon = '/map/pickup-pin.svg';
const selectedIcon = '/map/pickup-pin-selected.svg';

export const PickupMap = ({ points, selectedId, center, isLoading, onSelect }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<YMapInstance | null>(null);
  const clustererRef = useRef<YClusterer | null>(null);
  const marksRef = useRef<Map<string, YPlacemark>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    safeLoadYmaps()
      .then((ymaps) => {
        const ymapsApi = ymaps as unknown as Record<string, any>;
        if (!isMounted || !mapRef.current || mapInstanceRef.current) {
          return;
        }

        const map = new ymapsApi.Map(mapRef.current, {
          center: [center.lat, center.lng],
          zoom: 12,
          controls: ['zoomControl'],
          suppressMapOpenBlock: true,
          avoidFractionalZoom: true
        }) as YMapInstance;

        map.behaviors.disable('scrollZoom');

        const clusterer = new ymapsApi.Clusterer({
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterOpenBalloonOnClick: false
        });

        map.geoObjects.add(clusterer);
        mapInstanceRef.current = map;
        clustererRef.current = clusterer;
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message);
        }
      });

    return () => {
      isMounted = false;
      clustererRef.current?.removeAll();
      mapInstanceRef.current?.geoObjects.removeAll();
      mapInstanceRef.current?.destroy();
      clustererRef.current = null;
      mapInstanceRef.current = null;
      marksRef.current.clear();
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterer = clustererRef.current;
    if (!map || !clusterer) {
      return;
    }

    safeLoadYmaps().then((ymaps) => {
      const ymapsApi = ymaps as unknown as Record<string, any>;
      clusterer.removeAll();
      marksRef.current.clear();

      const marks = points.map((point) => {
        const placemark = new ymapsApi.Placemark(
          [point.lat, point.lng],
          {
            hintContent: point.address,
            balloonContentBody: point.address
          },
          {
            iconLayout: 'default#image',
            iconImageHref: point.id === selectedId ? selectedIcon : defaultIcon,
            iconImageSize: [34, 42],
            iconImageOffset: [-17, -42]
          }
        ) as unknown as YPlacemark;

        placemark.events.add('click', () => onSelect(point.id));
        marksRef.current.set(point.id, placemark);
        return placemark;
      });

      clusterer.add(marks);
      const bounds = clusterer.getBounds();

      if (bounds) {
        map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 32 });
      } else {
        map.setCenter([center.lat, center.lng], 12);
      }
    }).catch(() => undefined);
  }, [center.lat, center.lng, onSelect, points, selectedId]);

  useEffect(() => {
    marksRef.current.forEach((placemark, id) => {
      placemark.options.set('iconImageHref', id === selectedId ? selectedIcon : defaultIcon);
    });
  }, [selectedId]);

  if (error) {
    return <div className={styles.fallback}>Не удалось загрузить карту: {error}</div>;
  }

  return (
    <div className={styles.mapShell}>
      <div ref={mapRef} className={styles.map} />
      {isLoading ? <div className={styles.loading}>Загрузка ПВЗ…</div> : null}
    </div>
  );
};
