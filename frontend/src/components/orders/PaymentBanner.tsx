import type { PaymentIntent } from '../../shared/types';
import styles from './OrdersComponents.module.css';

interface PaymentBannerProps {
  paymentIntent: PaymentIntent;
}

export const PaymentBanner = ({ paymentIntent }: PaymentBannerProps) => {
  return (
    <div className={styles.paymentBanner}>
      <strong>Оплата заказа</strong>
      <span>Секрет платежа: {paymentIntent.clientSecret ?? paymentIntent.id}</span>
    </div>
  );
};
