import { resolveImageUrl } from '../shared/lib/resolveImageUrl';
import styles from './ProductMiniCard.module.css';
import { formatPrice } from '../utils/money';

interface ProductMiniCardProps {
  title: string;
  price: number;
  qty?: number;
  image?: string;
}

export const ProductMiniCard = ({ title, price, qty, image }: ProductMiniCardProps) => {
  const imageUrl = resolveImageUrl(image);

  return (
    <div className={styles.card}>
      {imageUrl ? <img src={imageUrl} alt={title} width={48} height={48} className={styles.image} /> : <span className={styles.placeholder} aria-hidden="true" />}
      <div className={styles.meta}>
        <strong>{title}</strong>
        <span>{formatPrice(price)} ₽</span>
        {typeof qty === 'number' ? <span className={styles.qty}>{qty} шт.</span> : null}
      </div>
    </div>
  );
};
