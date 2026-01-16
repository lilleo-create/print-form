import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from '../types';
import { loadYmaps } from '../lib/loadYmaps';
import { formatAddress } from '../lib/formatAddress';
import { Button } from './Button';
import styles from './AddressModal.module.css';

const addressSchema = z.object({
  city: z.string().min(2, 'Город'),
  street: z.string().min(2, 'Улица'),
  house: z.string().min(1, 'Дом'),
  apt: z.string().optional(),
  comment: z.string().optional()
});

type AddressFormValues = z.infer<typeof addressSchema>;

type AddressModalProps = {
  isOpen: boolean;
  addresses: Address[];
  selectedAddressId?: string;
  userId: string;
  onClose: () => void;
  onSelect: (addressId: string) => void;
  onCreate: (payload: Omit<Address, 'id' | 'createdAt'>) => Promise<Address>;
  onUpdate: (payload: Address) => Promise<Address>;
  onDelete: (addressId: string) => Promise<void>;
};

type Mode = 'list' | 'add' | 'edit';

const defaultCenter: [number, number] = [55.751244, 37.618423];

const extractAddressParts = (geoObject?: {
  getLocalities?: () => string[];
  getAdministrativeAreas?: () => string[];
  getThoroughfare?: () => string | undefined;
  getDependentLocality?: () => string | undefined;
  getPremiseNumber?: () => string | undefined;
}) => {
  if (!geoObject) {
    return { city: '', street: '', house: '' };
  }
  const city =
    geoObject.getLocalities?.()?.[0] ?? geoObject.getAdministrativeAreas?.()?.[0] ?? '';
  const street = geoObject.getThoroughfare?.() ?? geoObject.getDependentLocality?.() ?? '';
  const house = geoObject.getPremiseNumber?.() ?? '';
  return { city, street, house };
};

export const AddressModal = ({
  isOpen,
  addresses,
  selectedAddressId,
  userId,
  onClose,
  onSelect,
  onCreate,
  onUpdate,
  onDelete
}: AddressModalProps) => {
  const [mode, setMode] = useState<Mode>('list');
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [coords, setCoords] = useState<Address['coords'] | null>(null);
  const [mapError, setMapError] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const placemarkRef = useRef<any>(null);
  const ymapsRef = useRef<Awaited<ReturnType<typeof loadYmaps>> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<AddressFormValues>({ resolver: zodResolver(addressSchema) });

  const apiKey = import.meta.env.VITE_YMAPS_API_KEY as string | undefined;
  const isMapEnabled = Boolean(apiKey);

  const openList = () => {
    setMode('list');
    setEditingAddress(null);
    setCoords(null);
    setMapError('');
    reset({ city: '', street: '', house: '', apt: '', comment: '' });
  };

  const openAdd = () => {
    setMode('add');
    setEditingAddress(null);
    setCoords(null);
    setMapError('');
    reset({ city: '', street: '', house: '', apt: '', comment: '' });
  };

  const openEdit = (address: Address) => {
    setMode('edit');
    setEditingAddress(address);
    setCoords(address.coords ?? null);
    setMapError('');
    reset({
      city: address.city,
      street: address.street,
      house: address.house,
      apt: address.apt ?? '',
      comment: address.comment ?? ''
    });
  };

  useEffect(() => {
    if (!isOpen) {
      openList();
      return;
    }
    if (addresses.length === 0) {
      setMode('list');
    }
  }, [addresses.length, isOpen]);

  useEffect(() => {
    if (!isOpen || mode === 'list' || !isMapEnabled) {
      if (!isMapEnabled && mode !== 'list') {
        setMapError(
          'Не задан ключ VITE_YMAPS_API_KEY. Добавьте ключ в frontend/.env и перезапустите dev server.'
        );
      }
      return;
    }

    let isMounted = true;
    setIsMapReady(false);
    loadYmaps()
      .then((ymaps) => {
        ymapsRef.current = ymaps;
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
            handleCoordsSelect(clickedCoords);
          });
        } else if (coords) {
          mapInstanceRef.current.setCenter([coords.lat, coords.lon], 16);
        }

        if (coords) {
          updatePlacemark([coords.lat, coords.lon]);
          reverseGeocode([coords.lat, coords.lon]).catch(() => undefined);
        }

        setIsMapReady(true);
      })
      .catch((error: Error) => {
        if (isMounted) {
          setMapError(error.message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coords, isMapEnabled, isOpen, mode]);

  useEffect(() => {
    if (!isOpen) {
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
      placemarkRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode === 'list') {
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
      placemarkRef.current = null;
      setIsMapReady(false);
    }
  }, [mode]);

  const updatePlacemark = (nextCoords: number[]) => {
    if (!ymapsRef.current || !mapInstanceRef.current) {
      return;
    }
    if (!placemarkRef.current) {
      placemarkRef.current = new ymapsRef.current.Placemark(nextCoords);
      mapInstanceRef.current.geoObjects.add(placemarkRef.current);
    } else {
      placemarkRef.current.geometry?.setCoordinates?.(nextCoords);
    }
  };

  const reverseGeocode = async (nextCoords: number[]) => {
    if (!ymapsRef.current) {
      return;
    }
    const result = await ymapsRef.current.geocode(nextCoords);
    const geoObject = result.geoObjects.get(0);
    const nextAddress = extractAddressParts(geoObject);
    setValue('city', nextAddress.city);
    setValue('street', nextAddress.street);
    setValue('house', nextAddress.house);
  };

  const handleCoordsSelect = (nextCoords: number[]) => {
    setCoords({ lat: nextCoords[0], lon: nextCoords[1] });
    updatePlacemark(nextCoords);
    mapInstanceRef.current?.setCenter?.(nextCoords, 16);
    reverseGeocode(nextCoords).catch(() => undefined);
  };

  const onSubmit = async (values: AddressFormValues) => {
    if (mode === 'edit' && editingAddress) {
      await onUpdate({
        ...editingAddress,
        city: values.city,
        street: values.street,
        house: values.house,
        apt: values.apt,
        comment: values.comment,
        coords: coords ?? undefined
      });
    } else {
      await onCreate({
        userId,
        label: '',
        city: values.city,
        street: values.street,
        house: values.house,
        apt: values.apt,
        comment: values.comment,
        coords: coords ?? undefined
      });
    }
    openList();
  };

  const resolvedSelected = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Адреса</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {mode === 'list' && (
          <>
            {addresses.length === 0 ? (
              <div className={styles.empty}>
                <p>Адресов пока нет.</p>
              </div>
            ) : (
              <div className={styles.list}>
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className={styles.listItem}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelect(address.id);
                      onClose();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(address.id);
                        onClose();
                      }
                    }}
                  >
                    <span className={styles.marker}>📍</span>
                    <span className={styles.addressText}>{formatAddress(address)}</span>
                    {address.id === resolvedSelected?.id && (
                      <span className={styles.selected}>Выбран</span>
                    )}
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Редактировать"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(address);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Удалить"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(address.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" onClick={openAdd} className={styles.addButton}>
              Добавить адрес
            </Button>
          </>
        )}

        {mode !== 'list' && (
          <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
            <p className={styles.hint}>Укажите точку на карте</p>
            {mapError ? (
              <div className={styles.mapFallback}>{mapError}</div>
            ) : (
              <div className={styles.map} ref={mapRef}>
                {!isMapReady && <span className={styles.mapLoading}>Загрузка карты...</span>}
              </div>
            )}

            <div className={styles.fields}>
              <label>
                Город
                <input {...register('city')} />
                {errors.city && <span>{errors.city.message}</span>}
              </label>
              <label>
                Улица
                <input {...register('street')} />
                {errors.street && <span>{errors.street.message}</span>}
              </label>
              <label>
                Дом
                <input {...register('house')} />
                {errors.house && <span>{errors.house.message}</span>}
              </label>
              <label>
                Квартира
                <input {...register('apt')} />
              </label>
              <label>
                Комментарий
                <input {...register('comment')} />
              </label>
            </div>

            <div className={styles.formActions}>
              <Button type="submit">Использовать этот адрес</Button>
              <button type="button" className={styles.secondaryButton} onClick={openList}>
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
