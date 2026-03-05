import { useNavigate } from 'react-router-dom';
import type { Order } from '../../shared/types';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import styles from './OrdersComponents.module.css';

interface OrderItemsListProps {
  order: Order;
}

export const OrderItemsList = ({ order }: OrderItemsListProps) => {
  const navigate = useNavigate();
  const firstItem = order.items[0];
  const imageUrl = resolveImageUrl(firstItem?.image);

  if (!firstItem) {
    return null;
  }

  return (
    <button
      type="button"
      className={styles.item}
      onClick={() => navigate(`/product/${firstItem.productId}`)}
    >
      {imageUrl ? <img src={imageUrl} alt={firstItem.title} width={48} height={48} /> : null}
      <div className={styles.itemInfo}>
        <strong>{firstItem.title}</strong>
        <span>{firstItem.qty} шт.</span>
      </div>
    </button>
  );
};
