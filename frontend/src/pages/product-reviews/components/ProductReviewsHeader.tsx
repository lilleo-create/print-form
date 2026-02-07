import { Rating } from '../../../shared/ui/Rating';
import type { Product } from '../../../shared/types';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import styles from './ProductReviewsHeader.module.css';

type ProductReviewsHeaderProps = {
  product: Product;
  ratingValue: number;
  ratingCount: number;
  reviewsCount: number;
  onBack: () => void;
  onBuyNow: () => void;
  onAddToCart: () => void;
};

export const ProductReviewsHeader = ({
  product,
  ratingValue,
  ratingCount,
  reviewsCount,
  onBack,
  onBuyNow,
  onAddToCart
}: ProductReviewsHeaderProps) => {
  return (
    <section className={styles.header}>
      <button type="button" className={styles.backButton} onClick={onBack}>
        ← Назад
      </button>
      <div className={styles.product}>
        <img src={resolveImageUrl(product.image)} alt={product.title} className={styles.productImage} />
        <div className={styles.productInfo}>
          <h1 className={styles.title}>{product.title}</h1>
          <div className={styles.ratingRow}>
            <Rating value={ratingValue} count={ratingCount} size="md" />
            <span className={styles.ratingValue}>{ratingValue.toFixed(1)}</span>
            <span className={styles.ratingMeta}>
              {ratingCount} оценок · {reviewsCount} отзывов
            </span>
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</div>
        <button type="button" className={styles.favoriteButton} aria-label="Добавить в избранное">
          ❤
        </button>
        <button type="button" className={styles.buyNow} onClick={onBuyNow}>
          Купить сейчас
        </button>
        <button type="button" className={styles.addToCart} onClick={onAddToCart}>
          В корзину
        </button>
      </div>
    </section>
  );
};
