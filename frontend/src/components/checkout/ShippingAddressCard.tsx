import styles from './ShippingAddressCard.module.css';

type ShippingAddressCardProps = {
  selectedAddressText: string;
  onOpenModal: () => void;
};

export const ShippingAddressCard = ({ selectedAddressText, onOpenModal }: ShippingAddressCardProps) => {
  const hasAddress =
    Boolean(selectedAddressText) &&
    selectedAddressText !== 'Выберите адрес' &&
    selectedAddressText !== 'нет адреса';

  return (
    <div className={styles.form}>
      <h3>Адрес доставки</h3>
      <button type="button" className={styles.addressSelector} onClick={onOpenModal}>
        <span className={`${styles.marker} ${hasAddress ? styles.markerOk : styles.markerError}`}>📍</span>
        <span className={hasAddress ? styles.addressOk : styles.addressError}>
          {hasAddress ? selectedAddressText : 'Выберите адрес'}
        </span>
      </button>
    </div>
  );
};
