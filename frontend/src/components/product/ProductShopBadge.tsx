import { Link } from 'react-router-dom';
import { Rating } from '../../shared/ui/Rating';
import { Skeleton } from '../../shared/ui/Skeleton';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import type { Shop } from '../../shared/types';
import styles from './ProductShopBadge.module.css';

interface ProductShopBadgeProps {
  shopId?: string | null;
  shop: Shop | null;
  loading: boolean;
  error: string | null;
  disabled: boolean;
}

const formatCompactNumber = (value?: number | null) => {
  if (!value && value !== 0) return null;
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

export const ProductShopBadge = ({ shopId, shop, loading, error, disabled }: ProductShopBadgeProps) => {
  const content = (
    <>
      <div className={styles.avatar}>
        {loading ? (
          <Skeleton className={styles.avatarSkeleton} variant="circle" />
        ) : shop?.avatarUrl ? (
          <img src={resolveImageUrl(shop.avatarUrl)} alt={shop.title} />
        ) : (
          <div className={styles.avatarFallback}>{shop?.title?.slice(0, 1) ?? 'М'}</div>
        )}
      </div>
      <div className={styles.info}>
        {loading ? (
          <Skeleton className={styles.titleSkeleton} />
        ) : (
          <div className={styles.title}>{shop?.title ?? 'Магазин'}</div>
        )}
        <div className={styles.meta}>
          {loading ? (
            <Skeleton className={styles.ratingSkeleton} />
          ) : error ? (
            <span className={styles.error}>Магазин недоступен</span>
          ) : (
            <>
              <Rating value={shop?.rating ?? 0} count={0} size="sm" />
              {shop?.reviewsCount ? (
                <span className={styles.reviews}>{formatCompactNumber(shop.reviewsCount)} оценок</span>
              ) : null}
            </>
          )}
        </div>
      </div>
      <span className={styles.chevron} aria-hidden>
        ›
      </span>
    </>
  );

  if (disabled || loading || error || !shopId || !shop) {
    return (
      <div className={`${styles.badge} ${styles.disabled}`} aria-disabled>
        {content}
      </div>
    );
  }

  return (
    <Link to={`/shop/${shopId}`} className={styles.badge}>
      {content}
    </Link>
  );
};
