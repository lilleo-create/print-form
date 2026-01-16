import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from '../../types';
import { formatShortAddress } from '../../lib/formatShortAddress';
import { Button } from '../Button';
import { AddressForm } from './AddressForm';
import { AddressMap } from './AddressMap';
import { addressFormSchema, AddressFormValues } from './addressFormSchema';
import styles from './AddressModal.module.css';

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

const getPrimaryText = (address: Address) => {
  if (address.label) {
    return address.label;
  }
  return formatShortAddress(address.addressText);
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
  const [coords, setCoords] = useState<Address['coords']>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      addressText: '',
      isFavorite: false
    }
  });

  const isFavorite = watch('isFavorite');
  const currentAddressText = watch('addressText');

  const resolvedSelected = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  const openList = () => {
    setMode('list');
    setEditingAddress(null);
    setCoords(null);
    reset({
      addressText: '',
      apartment: '',
      floor: '',
      label: '',
      courierComment: '',
      isFavorite: false
    });
  };

  const openAdd = () => {
    setMode('add');
    setEditingAddress(null);
    setCoords(null);
    reset({
      addressText: '',
      apartment: '',
      floor: '',
      label: '',
      courierComment: '',
      isFavorite: false
    });
  };

  const openEdit = (address: Address) => {
    setMode('edit');
    setEditingAddress(address);
    setCoords(address.coords);
    reset({
      addressText: address.addressText,
      apartment: address.apartment ?? '',
      floor: address.floor ?? '',
      label: address.label ?? '',
      courierComment: address.courierComment ?? '',
      isFavorite: Boolean(address.isFavorite)
    });
  };

  useEffect(() => {
    if (!isOpen) {
      openList();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isOpen, onClose]);

  const onSubmit = async (values: AddressFormValues) => {
    const payload = {
      userId,
      coords,
      addressText: values.addressText.trim(),
      apartment: values.apartment?.trim() || undefined,
      floor: values.floor?.trim() || undefined,
      label: values.label?.trim() || undefined,
      isFavorite: values.isFavorite,
      courierComment: values.courierComment?.trim() || undefined
    };

    if (mode === 'edit' && editingAddress) {
      await onUpdate({ ...editingAddress, ...payload });
    } else {
      await onCreate(payload);
    }
    openList();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
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
                    <div className={styles.addressInfo}>
                      <span className={styles.addressPrimary}>{getPrimaryText(address)}</span>
                      {address.label && (
                        <span className={styles.addressSecondary}>{address.addressText}</span>
                      )}
                    </div>
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
            <div className={styles.formLayout}>
              <div className={styles.formColumn}>
                <AddressForm register={register} errors={errors} isFavorite={isFavorite} />
                <div className={styles.formActions}>
                  <Button type="submit">
                    {mode === 'edit' ? 'Сохранить' : 'Использовать этот адрес'}
                  </Button>
                  <button type="button" className={styles.secondaryButton} onClick={openList}>
                    Отмена
                  </button>
                </div>
              </div>
              <div className={styles.mapColumn}>
                <p className={styles.hint}>Укажите точку на карте</p>
                <AddressMap
                  coords={coords}
                  addressText={currentAddressText}
                  onCoordsChange={setCoords}
                  onAddressTextChange={(value) => setValue('addressText', value)}
                  enableGeolocation={mode === 'add' && !coords}
                />
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
