import { useMemo } from 'react';
import { useAddressStore } from '../../../app/store/addressStore';
import { formatShortAddress } from '../../lib/formatShortAddress';
import styles from './HeaderAddress.module.css';

type HeaderAddressProps = {
  disabled?: boolean;
};

export const HeaderAddress = ({ disabled }: HeaderAddressProps) => {
  const addresses = useAddressStore((state) => state.addresses);
  const selectedAddressId = useAddressStore((state) => state.selectedAddressId);
  const openModal = useAddressStore((state) => state.openModal);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  const addressLabel = selectedAddress
    ? selectedAddress.isFavorite && selectedAddress.label
      ? selectedAddress.label
      : formatShortAddress(selectedAddress.addressText)
    : 'Выберите адрес';

  return (
    <button
      type="button"
      className={styles.addressButton}
      onClick={() => {
        if (!disabled) {
          openModal();
        }
      }}
      disabled={disabled}
    >
      <span className={styles.marker}>📍</span>
      <span>{addressLabel}</span>
    </button>
  );
};
