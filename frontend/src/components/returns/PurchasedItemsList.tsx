import { Link } from 'react-router-dom';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import styles from './PurchasedItemsList.module.css';

interface PurchasedItem {
  productId: string;
  title: string;
  price: number;
  image?: string;
  orderDate: string;
  orderId: string;
}

interface PurchasedItemsListProps {
  items: PurchasedItem[];
}

export const PurchasedItemsList = ({ items }: PurchasedItemsListProps) => {
  if (items.length === 0) {
    return <p className={styles.empty}>Пока нет купленных товаров.</p>;
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => {
        const imageUrl = resolveImageUrl(item.image);
        return (
          <Link
            to={`/product/${item.productId}`}
            key={`${item.orderId}-${item.productId}`}
            className={styles.card}
          >
            {imageUrl && <img src={imageUrl} alt={item.title} />}
            <div className={styles.body}>
              <h3>{item.title}</h3>
              <p className={styles.price}>{item.price.toLocaleString('ru-RU')} ₽</p>
              <span className={styles.caption}>
                Заказ от{' '}
                {new Date(item.orderDate).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
