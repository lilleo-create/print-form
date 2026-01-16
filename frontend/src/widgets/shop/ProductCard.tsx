import { KeyboardEvent } from 'react';
import { Product } from '../../shared/types';
import { useUiStore } from '../../app/store/uiStore';
import { useCartStore } from '../../app/store/cartStore';
import { Button } from '../../shared/ui/Button';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const openProduct = useUiStore((state) => state.openProduct);
  const addItem = useCartStore((state) => state.addItem);

  const handleOpen = () => {
    openProduct(product);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProduct(product);
    }
  };

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <img src={product.image} alt={product.title} className={styles.image} />
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{product.category}</span>
          <span>{product.material}</span>
        </div>
        <h3>{product.title}</h3>
        <p className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</p>
        <div className={styles.actions}>
          <Button onClick={handleOpen} aria-label={`Открыть ${product.title}`}>
            Подробнее
          </Button>
          <Button
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              addItem(product, 1);
            }}
          >
            В корзину
          </Button>
        </div>
      </div>
    </article>
  );
};
