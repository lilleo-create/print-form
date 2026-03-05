import { Order } from '../../../../shared/types';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import { getDeliveryStatusLabel } from '../../../../shared/lib/deliveryStatus';
import { getOrderDeliveryLabel } from '../../../../shared/lib/deliveryLabel';
import { useNavigate } from 'react-router-dom';
import styles from './OrdersTab.module.css';

interface OrdersTabProps {
  orders: Order[];
}

export const OrdersTab = ({ orders }: OrdersTabProps) => {
  const navigate = useNavigate();

  return (
    <div className={styles.section}>
      {orders.length === 0 ? (
        <p className={styles.empty}>Активных заказов нет.</p>
      ) : (
        <div className={styles.ordersList}>
          {orders.map((order) => {
            const product = order.items[0];
            const imageSrc = resolveImageUrl(product?.image);

            if (!product) return null;

            return (
              <article
                key={order.id}
                className={styles.orderCard}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/product/${product.productId}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/product/${product.productId}`);
                  }
                }}
              >
                <div className={styles.orderHeader}>
                  <div>
                    <h3>Заказ №{order.id}</h3>
                    <span>
                      {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className={styles.total}>{order.total.toLocaleString('ru-RU')} ₽</div>
                </div>

                <div className={styles.productCard}>
                  {imageSrc ? (
                    <img className={styles.productImage} src={imageSrc} alt={product.title} />
                  ) : (
                    <div className={styles.imagePlaceholder} aria-hidden="true" />
                  )}
                  <div className={styles.itemInfo}>
                    <strong>{product.title}</strong>
                    <span>{product.price.toLocaleString('ru-RU')} ₽</span>
                    {order.items.length > 1 ? <span className={styles.caption}>+ еще {order.items.length - 1}</span> : null}
                  </div>
                </div>

                <p className={styles.status}>Статус доставки: {getDeliveryStatusLabel(order)}</p>
                {order.trackingNumber ? <p className={styles.caption}>СДЭК: {order.trackingNumber}</p> : null}
                {getOrderDeliveryLabel(order) ? <p className={styles.caption}>{getOrderDeliveryLabel(order)}</p> : null}

                <button
                  type="button"
                  className={styles.returnLink}
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/returns?orderId=${order.id}`);
                  }}
                >
                  Оформить возврат
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
