import { useNavigate } from 'react-router-dom';
import type { Product } from '../../shared/types';
import { SmartImage } from '../../shared/ui/SmartImage';
import { useCartStore } from '../../app/store/cartStore';
import { formatPriceNoKopecks } from '../../shared/lib/formatPrice';
import { getProductMainImage } from '../../shared/lib/productMedia';
import styles from './HomeProductCard.module.css';

type Props = { product: Product };

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const getTag = (product: Product): { label: string; type: 'primary' | 'success' | 'warning' | null } | null => {
  if (product.stock === 0) return null;
  if (product.ratingCount && product.ratingCount > 100) return { label: 'Хит', type: 'primary' };
  if (product.stock && product.stock > 0) return { label: 'Готов', type: 'success' };
  return null;
};

export const HomeProductCard = ({ product }: Props) => {
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const img = getProductMainImage(product);
  const tag = getTag(product);

  const price = typeof product.price === 'number' && !isNaN(product.price)
    ? formatPriceNoKopecks(product.price)
    : 'Цена по запросу';

  return (
    <article
      className={styles.card}
      onClick={() => navigate(`/product/${product.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${product.id}`); }}
    >
      <div className={styles.imgWrap}>
        <SmartImage src={img} alt={product.title} className={styles.img} sizePreset="card" />
        {tag ? (
          <div className={styles.imgTags}>
            <span className={`${styles.tag} ${styles[tag.type ?? '']}`}>{tag.label}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        <div className={styles.title}>{product.title}</div>

        <div className={styles.seller}>
          <span className={styles.sellerDot} />
          {product.material ? `${product.material}` : 'PrintForm'}
        </div>

        <div className={styles.priceRow}>
          <div className={styles.price}>{price}</div>
          <button
            className={styles.addBtn}
            onClick={(e) => { e.stopPropagation(); addItem(product, 1); }}
            title="В корзину"
            aria-label="В корзину"
          >
            <PlusIcon />
          </button>
        </div>

        <div className={styles.metaRow}>
          {product.ratingAvg ? (
            <span className={styles.rating}>
              <span className={styles.star}>★</span>
              {product.ratingAvg.toFixed(1)}
              {product.ratingCount ? <span className={styles.ratingCount}> · {product.ratingCount}</span> : null}
            </span>
          ) : (
            <span className={styles.noRating}>Нет отзывов</span>
          )}
        </div>
      </div>
    </article>
  );
};
