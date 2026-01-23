import { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../shared/types';
import { useCartStore } from '../../app/store/cartStore';
import { Button } from '../../shared/ui/Button';
import { Rating } from '../../shared/ui/Rating';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const handleOpen = () => {
    navigate(`/product/${product.id}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
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
        <Rating value={product.ratingAvg} count={product.ratingCount} />
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
