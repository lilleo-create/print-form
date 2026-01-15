import { Product } from '../../shared/types';
import { useUiStore } from '../../app/store/uiStore';
import { Button } from '../../shared/ui/Button';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const openProduct = useUiStore((state) => state.openProduct);

  return (
    <article className={styles.card}>
      <img src={product.image} alt={product.title} className={styles.image} />
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{product.category}</span>
          <span>{product.material}</span>
        </div>
        <h3>{product.title}</h3>
        <p className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</p>
        <Button onClick={() => openProduct(product)} aria-label={`Открыть ${product.title}`}>
          Подробнее
        </Button>
      </div>
    </article>
  );
};
