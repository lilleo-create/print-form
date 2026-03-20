import { useMemo } from 'react';
import { Button } from '../../../../shared/ui/Button';
import { Rating } from '../../../../shared/ui/Rating';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import { HeaderActions } from '../../../../widgets/header/HeaderActions';
import type { Shop } from '../../../../shared/types';
import styles from './ShopHeader.module.css';

interface ShopHeaderProps {
  shop: Shop | null;
  loading: boolean;
  error: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onRetry: () => void;
  onMessage: () => void;
  onBack: () => void;
  onOpenInfo: () => void;
  onCopyLink: () => void;
  onOpenProfileMenu: () => void;
}

const formatCompactNumber = (value?: number | null) => {
  if (!value && value !== 0) return null;
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

export const ShopHeader = ({
  shop,
  loading,
  error,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onRetry,
  onMessage,
  onBack,
  onOpenInfo,
  onCopyLink,
  onOpenProfileMenu
}: ShopHeaderProps) => {
  const avatarText = useMemo(() => {
    if (!shop?.title) return 'М';
    return shop.title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }, [shop?.title]);

  if (error) {
    return (
      <div className={styles.wrapper}>
        <div className="container">
          <div className={styles.error}>
            <p>Не удалось загрузить данные магазина.</p>
            <Button onClick={onRetry}>Повторить</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className="container">
        <div className={styles.header}>
          <div className={styles.shopMeta}>
            {loading ? (
              <Skeleton className={styles.avatarSkeleton} variant="circle" />
            ) : shop?.avatarUrl ? (
              <img className={styles.avatar} src={resolveImageUrl(shop.avatarUrl)} alt={shop.title} />
            ) : (
              <div className={styles.avatarFallback}>{avatarText}</div>
            )}
            <div>
              {loading ? (
                <Skeleton className={styles.titleSkeleton} />
              ) : (
                <h1 className={styles.title}>{shop?.title ?? 'Магазин'}</h1>
              )}
              {loading ? (
                <Skeleton className={styles.ratingSkeleton} />
              ) : (
                <div className={styles.ratingRow}>
                  <Rating value={shop?.rating ?? 0} count={shop?.reviewsCount ?? 0} size="sm" />
                  {shop?.reviewsCount ? (
                    <span className={styles.reviewsText}>
                      {formatCompactNumber(shop.reviewsCount)} оценок
                    </span>
                  ) : (
                    <span className={styles.reviewsText}>Нет оценок</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <form
            className={styles.search}
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit();
            }}
          >
            <input
              type="search"
              placeholder="Найти в магазине"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <Button type="submit" size="sm">
              Найти
            </Button>
          </form>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onMessage}>
              Написать
            </Button>
            <button type="button" className={styles.iconButton} onClick={onOpenInfo} aria-label="Данные магазина">
              i
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onCopyLink}
              aria-label="Скопировать адрес профиля"
            >
              🔗
            </button>
            <HeaderActions variant="compact" onProfileClick={onOpenProfileMenu} />
          </div>
        </div>
        <div className={styles.subLinks}>
          <button type="button" className={styles.backLink} onClick={onBack}>
            Назад
          </button>
        </div>
      </div>
    </div>
  );
};
