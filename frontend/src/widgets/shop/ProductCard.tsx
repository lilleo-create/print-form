import { KeyboardEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../shared/types';
import { useCartStore } from '../../app/store/cartStore';
import { Button } from '../../shared/ui/Button';
import { Rating } from '../../shared/ui/Rating';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl'; // <-- поправь путь под свой проект
import styles from './ProductCard.module.css';
import { useEffect } from 'react';
interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const [imgBroken, setImgBroken] = useState(false);

  const imageSrc = useMemo(() => resolveImageUrl(product.image), [product.image]);

  const handleOpen = () => {
    navigate(`/product/${product.id}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  };
useEffect(() => {
  setImgBroken(false);
}, [imageSrc]);
  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      {imageSrc && !imgBroken ? (
        <img
          src={imageSrc}
          alt={product.title}
          className={styles.image}
          loading="lazy"
          onError={() => setImgBroken(true)}
          onLoad={() => setImgBroken(false)}
        />
      ) : (
        <div className={styles.imagePlaceholder}>Нет изображения</div>
      )}

      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{product.category}</span>
          <span>{product.material}</span>
          <span>Изготовление: {product.productionTimeHours ?? 24} ч</span>
          {product.dxCm && product.dyCm && product.dzCm ? <span>Размер: {product.dxCm}×{product.dyCm}×{product.dzCm} см</span> : null}
        </div>

        <h3 className={styles.title} title={product.title}>
          {product.title}
        </h3>

        <Rating value={product.ratingAvg} count={product.ratingCount} />

        <p className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</p>

        <div className={styles.actions}>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleOpen();
            }}
            aria-label={`Открыть ${product.title}`}
          >
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
