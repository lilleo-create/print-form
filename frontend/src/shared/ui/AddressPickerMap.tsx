import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { safeLoadYmaps } from '../lib/safeLoadYmaps';
import styles from './AddressPickerMap.module.css';

type AddressCoords = {
  lat: number;
  lon: number;
};

type AddressData = {
  city: string;
  street: string;
  house: string;
  coords: AddressCoords;
};

type AddressPickerMapProps = {
  initialCoords?: AddressCoords;
  onConfirm: (data: AddressData) => void;
  onCancel: () => void;
};

type YMapsGeoObject = {
  geometry?: {
    getCoordinates?: () => number[];
    setCoordinates?: (coords: number[]) => void;
  };
  getLocalities?: () => string[];
  getAdministrativeAreas?: () => string[];
  getThoroughfare?: () => string | undefined;
  getDependentLocality?: () => string | undefined;
  getPremiseNumber?: () => string | undefined;
};

type YMapsPlacemark = {
  geometry?: {
    setCoordinates?: (coords: number[]) => void;
  };
};

type YMapsMap = {
  geoObjects: {
    add: (placemark: YMapsPlacemark) => void;
    remove?: (placemark: YMapsPlacemark) => void;
  };
  setCenter: (coords: number[], zoom?: number) => void;
  events: {
    add: (event: string, handler: (event: { get: (key: string) => number[] }) => void) => void;
  };
  destroy?: () => void;
};

type YMapsApi = Awaited<ReturnType<typeof safeLoadYmaps>> & {
  Map: new (
    element: HTMLElement,
    options: { center: number[]; zoom: number; controls?: string[] }
  ) => YMapsMap;
  Placemark: new (coords: number[]) => YMapsPlacemark;
  geocode: (
    query: string | number[]
  ) => Promise<{ geoObjects: { get: (index: number) => YMapsGeoObject | undefined } }>;
};

const defaultCenter: [number, number] = [55.751244, 37.618423];

const extractAddressParts = (geoObject?: YMapsGeoObject) => {
  if (!geoObject) {
    return { city: '', street: '', house: '' };
  }
  const city =
    geoObject.getLocalities?.()?.[0] ?? geoObject.getAdministrativeAreas?.()?.[0] ?? '';
  const street = geoObject.getThoroughfare?.() ?? geoObject.getDependentLocality?.() ?? '';
  const house = geoObject.getPremiseNumber?.() ?? '';
  return { city, street, house };
};

export const AddressPickerMap = ({ initialCoords, onConfirm, onCancel }: AddressPickerMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<YMapsMap | null>(null);
  const placemarkRef = useRef<YMapsPlacemark | null>(null);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<AddressCoords | null>(initialCoords ?? null);
  const [address, setAddress] = useState<{ city: string; street: string; house: string } | null>(
    null
  );
  const [error, setError] = useState('');

  const updatePlacemark = (ymaps: YMapsApi, nextCoords: number[]) => {
    if (!mapInstanceRef.current) {
      return;
    }
    if (!placemarkRef.current) {
      placemarkRef.current = new ymaps.Placemark(nextCoords);
      mapInstanceRef.current.geoObjects.add(placemarkRef.current);
    } else {
      placemarkRef.current.geometry?.setCoordinates?.(nextCoords);
    }
  };

  const reverseGeocode = async (ymaps: YMapsApi, nextCoords: number[]) => {
    const result = await ymaps.geocode(nextCoords);
    const geoObject = result.geoObjects.get(0);
    const nextAddress = extractAddressParts(geoObject);
    setAddress(nextAddress);
  };

  const handleCoordsSelect = async (
    ymaps: YMapsApi,
    nextCoords: number[]
  ) => {
    setError('');
    setCoords({ lat: nextCoords[0], lon: nextCoords[1] });
    updatePlacemark(ymaps, nextCoords);
    mapInstanceRef.current?.setCenter(nextCoords, 16);
    await reverseGeocode(ymaps, nextCoords);
  };

  useEffect(() => {
    let isMounted = true;

    safeLoadYmaps()
      .then((ymaps) => {
        ymapsRef.current = ymaps as YMapsApi;
        if (!isMounted || !mapRef.current || mapInstanceRef.current) {
          return;
        }

        mapInstanceRef.current = new ymaps.Map(mapRef.current, {
          center: coords ? [coords.lat, coords.lon] : defaultCenter,
          zoom: coords ? 16 : 10,
          controls: ['zoomControl', 'fullscreenControl']
        });

        mapInstanceRef.current.events.add('click', (event: { get: (key: string) => number[] }) => {
          const clickedCoords = event.get('coords');
          handleCoordsSelect(ymaps, clickedCoords);
        });

        if (coords) {
          updatePlacemark(ymaps, [coords.lat, coords.lon]);
          reverseGeocode(ymaps, [coords.lat, coords.lon]).catch(() => undefined);
        }
      })
      .catch((loadError: Error) => {
        setError(loadError.message);
      });

    return () => {
      isMounted = false;
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
      placemarkRef.current = null;
    };
  }, []);

  const handleSearch = async () => {
    if (!query.trim() || !ymapsRef.current) {
      return;
    }
    const result = await ymapsRef.current.geocode(query.trim());
    const geoObject = result.geoObjects.get(0);
    if (!geoObject?.geometry?.getCoordinates) {
      setError('Не удалось найти адрес. Попробуйте другой запрос.');
      return;
    }
    const foundCoords = geoObject.geometry.getCoordinates();
    await handleCoordsSelect(ymapsRef.current, foundCoords);
  };

  const handleConfirm = () => {
    if (!coords) {
      setError('Выберите точку на карте.');
      return;
    }
    onConfirm({
      city: address?.city ?? '',
      street: address?.street ?? '',
      house: address?.house ?? '',
      coords
    });
  };

  const handleCancel = () => {
    setCoords(null);
    setAddress(null);
    if (placemarkRef.current) {
      mapInstanceRef.current?.geoObjects?.remove?.(placemarkRef.current);
      placemarkRef.current = null;
    }
    onCancel();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Введите адрес для поиска"
        />
        <button type="button" className={styles.secondaryButton} onClick={handleSearch}>
          Найти
        </button>
      </div>
      <div className={styles.map} ref={mapRef} />
      {error && <p className={styles.error}>{error}</p>}
      {coords && address && (
        <div className={styles.result}>
          <strong>Выбранный адрес:</strong>
          <span>
            {address.city || 'Город не определен'}
            {address.street ? `, ${address.street}` : ''}
            {address.house ? `, ${address.house}` : ''}
          </span>
        </div>
      )}
      <div className={styles.actions}>
        <Button type="button" onClick={handleConfirm}>
          Использовать этот адрес
        </Button>
        <button type="button" className={styles.secondaryButton} onClick={handleCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
};
