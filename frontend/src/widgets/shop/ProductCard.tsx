import { KeyboardEvent, useMemo } from 'react';
import { getProductGroupKey, getProductVariants } from '../../shared/lib/productGrouping';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../shared/types';
import { useCartStore } from '../../app/store/cartStore';
import { Button } from '../../shared/ui/Button';
import { Rating } from '../../shared/ui/Rating';
import { getProductMainImage } from '../../shared/lib/productMedia';
import styles from './ProductCard.module.css';
import { formatEtaDays } from '../../shared/lib/deliveryEta';
import { SmartImage } from '../../shared/ui/SmartImage';
import { formatPrice } from '../../utils/money';
interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const imageSrc = useMemo(() => getProductMainImage(product), [product]);

  const groupKey = useMemo(() => getProductGroupKey(product), [product]);
  const variantProducts = useMemo(() => {
    const pool = (product as Product & { variantProducts?: Product[] }).variantProducts;
    if (Array.isArray(pool) && pool.length) {
      return getProductVariants(product, pool);
    }
    return [product];
  }, [product]);

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
      <div className={styles.imageFrame}>
        {imageSrc ? (
          <SmartImage src={imageSrc} alt={product.title} className={styles.image} sizePreset="card" />
        ) : (
          <div className={styles.imagePlaceholder}>Нет изображения</div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.metaItem}>{product.category}</span>
          <span className={styles.metaItem}>{product.material}</span>
          <span className={styles.metaItem}>Изготовление: {product.productionTimeHours ?? 24} ч</span>
          {product.dxCm && product.dyCm && product.dzCm ? (
            <span className={styles.metaItem}>Размер: {product.dxCm} × {product.dyCm} × {product.dzCm} см</span>
          ) : null}
        </div>

        <h3 className={styles.title} title={product.title}>
          {product.title}
        </h3>

        {groupKey && variantProducts.length > 1 ? (
          <div className={styles.variantChips} onClick={(event) => event.stopPropagation()}>
            {variantProducts.slice(0, 4).map((variant) => (
              <button
                key={variant.id}
                type="button"
                className={variant.id === product.id ? styles.variantChipActive : styles.variantChip}
                onClick={() => navigate(`/product/${variant.id}`)}
              >
                {variant.color || variant.title}
              </button>
            ))}
          </div>
        ) : null}

        <p className={styles.deliveryMeta}>
          Доставка СДЭК:{' '}
          {formatEtaDays(product.deliveryDaysMin ?? null, product.deliveryDaysMax ?? null) ?? 'Срок уточняется'}
        </p>

        <div className={styles.footer}>
          <div className={styles.summary}>
            <Rating value={product.ratingAvg} count={product.ratingCount} />
            <p className={styles.price}>{formatPrice(product.price)}</p>
          </div>

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
      </div>
    </article>
  );
};
