import { KeyboardEvent, useMemo } from 'react';
import { getProductGroupKey, getProductVariants } from '../../shared/lib/productGrouping';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../shared/types';
import { useCartStore } from '../../app/store/cartStore';
import { Rating } from '../../shared/ui/Rating';
import { getProductMainImage } from '../../shared/lib/productMedia';
import { getProductRatingMeta } from '../../shared/lib/productRating';
import styles from './ProductCard.module.css';
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

  const ratingMeta = getProductRatingMeta(product);

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
        <h3 className={styles.title} title={product.title}>
          {product.title}
        </h3>

        <p className={styles.price}>{formatPrice(product.price)}</p>

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

        <div className={styles.footer}>
          {ratingMeta.hasReviews ? (
            <Rating value={ratingMeta.ratingValue} count={ratingMeta.ratingCount} />
          ) : (
            <span className={styles.noRating}>Пока нет отзывов</span>
          )}

          <button
            type="button"
            className={styles.cartBtn}
            onClick={(event) => {
              event.stopPropagation();
              addItem(product, 1);
            }}
          >
            В корзину
          </button>
        </div>
      </div>
    </article>
  );
};
