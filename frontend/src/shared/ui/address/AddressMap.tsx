import { useEffect, useRef, useState } from 'react';
import { safeLoadYmaps, YmapsGeoObject, YmapsMapInstance } from '../../lib/safeLoadYmaps';
import styles from './AddressModal.module.css';

type AddressMapProps = {
  coords: { lat: number; lon: number } | null;
  addressText: string;
  onCoordsChange: (coords: { lat: number; lon: number } | null) => void;
  onAddressTextChange: (value: string) => void;
  enableGeolocation: boolean;
};

const defaultCenter: [number, number] = [55.751244, 37.618423];

const extractAddressText = (geoObject?: YmapsGeoObject) => {
  if (!geoObject) {
    return '';
  }
  const addressLine = geoObject.getAddressLine?.();
  if (addressLine) {
    return addressLine;
  }
  const parts = [
    geoObject.getLocalities?.()?.[0],
    geoObject.getThoroughfare?.() ?? geoObject.getDependentLocality?.(),
    geoObject.getPremiseNumber?.()
  ].filter(Boolean);
  return parts.join(', ');
};

export const AddressMap = ({
  coords,
  addressText,
  onCoordsChange,
  onAddressTextChange,
  enableGeolocation
}: AddressMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<YmapsMapInstance | null>(null);
  const placemarkRef = useRef<unknown>(null);
  const geolocationAttemptedRef = useRef(false);
  const [mapError, setMapError] = useState('');
  const [mapHint, setMapHint] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);

  const updatePlacemark = (ymaps: Awaited<ReturnType<typeof safeLoadYmaps>>, nextCoords: number[]) => {
    if (!mapInstanceRef.current) {
      return;
    }
    if (!placemarkRef.current) {
      placemarkRef.current = new ymaps.Placemark(nextCoords);
      mapInstanceRef.current.geoObjects.add(placemarkRef.current);
    } else if ('geometry' in (placemarkRef.current as { geometry?: { setCoordinates: (coords: number[]) => void } })) {
      (placemarkRef.current as { geometry?: { setCoordinates: (coords: number[]) => void } }).geometry?.setCoordinates(
        nextCoords
      );
    }
  };

  const reverseGeocode = async (
    ymaps: Awaited<ReturnType<typeof safeLoadYmaps>>,
    nextCoords: number[]
  ) => {
    const result = await ymaps.geocode(nextCoords);
    const geoObject = result.geoObjects.get(0);
    const addressText = extractAddressText(geoObject);
    if (addressText) {
      onAddressTextChange(addressText);
    }
  };

  const resolveGeolocation = async (ymaps: Awaited<ReturnType<typeof safeLoadYmaps>>) => {
    try {
      const result = await ymaps.geolocation.get({ provider: 'browser', mapStateAutoApply: false });
      const geo = result.geoObjects.get(0);
      if (geo?.geometry?.getCoordinates) {
        return geo;
      }
    } catch {
      // ignore and fall back
    }
    try {
      const result = await ymaps.geolocation.get({ provider: 'yandex', mapStateAutoApply: false });
      return result.geoObjects.get(0);
    } catch {
      return undefined;
    }
  };

  const handleCoordsSelect = async (
    ymaps: Awaited<ReturnType<typeof safeLoadYmaps>>,
    nextCoords: number[]
  ) => {
    onCoordsChange({ lat: nextCoords[0], lon: nextCoords[1] });
    updatePlacemark(ymaps, nextCoords);
    mapInstanceRef.current?.setCenter(nextCoords, 16);
    await reverseGeocode(ymaps, nextCoords);
  };

  useEffect(() => {
    let isMounted = true;
    setMapError('');
    setIsMapReady(false);

    safeLoadYmaps()
      .then((ymaps) => {
        if (!isMounted || !mapRef.current) {
          return;
        }

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new ymaps.Map(mapRef.current, {
            center: coords ? [coords.lat, coords.lon] : defaultCenter,
            zoom: coords ? 16 : 10,
            controls: ['zoomControl', 'fullscreenControl']
          });

          mapInstanceRef.current.events.add('click', (event: { get: (key: string) => number[] }) => {
            const clickedCoords = event.get('coords');
            handleCoordsSelect(ymaps, clickedCoords).catch(() => undefined);
          });
        } else if (coords) {
          mapInstanceRef.current.setCenter([coords.lat, coords.lon], 16);
        }

        if (coords) {
          updatePlacemark(ymaps, [coords.lat, coords.lon]);
          reverseGeocode(ymaps, [coords.lat, coords.lon]).catch(() => undefined);
        } else if (enableGeolocation && !geolocationAttemptedRef.current) {
          geolocationAttemptedRef.current = true;
          resolveGeolocation(ymaps).then((geo) => {
            if (!geo?.geometry?.getCoordinates) {
              setMapHint('Разрешите доступ к геолокации или выберите точку на карте.');
              return;
            }
            const coords = geo.geometry.getCoordinates();
            handleCoordsSelect(ymaps, coords).catch(() => undefined);
            const userAddress = geo.properties?.get?.('text');
            if (userAddress && !addressText.trim()) {
              onAddressTextChange(userAddress);
            } else if (!userAddress) {
              reverseGeocode(ymaps, coords).catch(() => undefined);
            }
          });
        }

        setIsMapReady(true);
      })
      .catch((error: Error) => {
        if (isMounted) {
          const message =
            error.message === 'Missing VITE_YMAPS_API_KEY.'
              ? 'Не задан ключ VITE_YMAPS_API_KEY. Добавьте его в frontend/.env и перезапустите dev server.'
              : error.message;
          setMapError(message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [addressText, coords, enableGeolocation]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      placemarkRef.current = null;
    };
  }, []);

  if (mapError) {
    return (
      <div className={styles.mapFallback}>
        {mapError} Можно продолжить вручную без карты.
      </div>
    );
  }

  return (
    <div className={styles.map} ref={mapRef}>
      {!isMapReady && <span className={styles.mapLoading}>Загрузка карты...</span>}
      {mapHint && <span className={styles.mapHint}>{mapHint}</span>}
    </div>
  );
};
