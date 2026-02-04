import styles from '../../pages/CheckoutPage.module.css';

type ShippingAddressCardProps = {
  selectedAddressText: string;
  onOpenModal: () => void;
};

export const ShippingAddressCard = ({ selectedAddressText, onOpenModal }: ShippingAddressCardProps) => (
  <div className={styles.form}>
    <h3>Адрес доставки</h3>
    <button type="button" className={styles.addressSelector} onClick={onOpenModal}>
      <span className={styles.marker}>📍</span>
      <span>{selectedAddressText}</span>
    </button>
  </div>
);
