import type { CartItem } from '../../shared/types';
import styles from '../../pages/CheckoutPage.module.css';

type OrderSummaryProps = {
  items: CartItem[];
  total: number;
  onConfirm: () => void;
  disabled?: boolean;
};

export const OrderSummary = ({ items, total, onConfirm, disabled = false }: OrderSummaryProps) => (
  <aside className={styles.summary}>
    <h3>Ваш заказ</h3>
    <ul>
      {items.map((item) => (
        <li key={item.product.id}>
          {item.product.title} × {item.quantity}
          <span>{(item.product.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
        </li>
      ))}
    </ul>
    <div className={styles.total}>
      <span>Итого</span>
      <strong>{total.toLocaleString('ru-RU')} ₽</strong>
    </div>
    <button className={styles.primaryButton} type="button" onClick={onConfirm} disabled={disabled}>
      Подтвердить заказ
    </button>
  </aside>
);
