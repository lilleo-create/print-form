import { useMemo, useRef, useState } from 'react';
import { Rating } from '../../../../shared/ui/Rating';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import { HeaderActions } from '../../../../widgets/header/HeaderActions';
import { Button } from '../../../../shared/ui/Button';
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

const formatCompactNumber = (v?: number | null) =>
  v || v === 0
    ? new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
    : null;

const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
  </svg>
);

export const ShopHeader = ({
  shop, loading, error,
  searchValue, onSearchChange, onSearchSubmit,
  onRetry, onMessage, onBack, onOpenInfo, onCopyLink, onOpenProfileMenu
}: ShopHeaderProps) => {
  const [searchOverlay, setSearchOverlay] = useState(false);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const avatarText = useMemo(() => {
    if (!shop?.title) return 'М';
    return shop.title.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }, [shop?.title]);

  const openOverlay = () => {
    setSearchOverlay(true);
    setTimeout(() => overlayInputRef.current?.focus(), 50);
  };
  const closeOverlay = () => setSearchOverlay(false);
  const handleOverlaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
    closeOverlay();
  };

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
    <>
      <div className={styles.wrapper}>
        <div className="container">

          {/* Desktop back button */}
          <button type="button" className={styles.backBtn} onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Назад
          </button>

          {/* Mobile top bar: [←] [search trigger] [🔔] */}
          <div className={styles.mobileTopBar}>
            <button type="button" className={styles.mobileIconBtn} onClick={onBack} aria-label="Назад">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button type="button" className={styles.mobileSearchTrigger} onClick={openOverlay}>
              <SearchIcon size={14} />
              <span className={styles.mobileSearchPlaceholder}>
                {searchValue || 'Найти в магазине'}
              </span>
            </button>

            <button type="button" className={styles.mobileIconBtn} aria-label="Уведомления">
              <BellIcon />
            </button>
          </div>

          {/* Desktop header */}
          <div className={styles.header}>
            <div className={styles.shopMeta}>
              {loading ? (
                <Skeleton className={styles.avatarSkeleton} variant="circle" />
              ) : shop?.avatarUrl ? (
                <img className={styles.avatar} src={resolveImageUrl(shop.avatarUrl)} alt={shop.title} />
              ) : (
                <div className={styles.avatarFallback}>{avatarText}</div>
              )}
              <div className={styles.shopMetaText}>
                {loading ? (
                  <Skeleton className={styles.titleSkeleton} />
                ) : (
                  <>
                    <h1 className={styles.title}>{shop?.title ?? 'Магазин'}</h1>
                    {shop?.publicationStatusLabel && (
                      <p className={styles.publicationStatus}>{shop.publicationStatusLabel}</p>
                    )}
                  </>
                )}
                {loading ? (
                  <Skeleton className={styles.ratingSkeleton} />
                ) : (
                  <div className={styles.ratingRow}>
                    <Rating value={shop?.rating ?? 0} count={shop?.reviewsCount ?? 0} size="sm" />
                    <span className={styles.reviewsText}>
                      {shop?.reviewsCount ? `${formatCompactNumber(shop.reviewsCount)} оценок` : 'Нет оценок'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <form className={styles.search} onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }}>
              <span className={styles.searchIcon}><SearchIcon /></span>
              <input
                type="search"
                placeholder="Найти в магазине"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </form>

            <div className={styles.actions}>
              <Button type="button" variant="secondary" size="sm" onClick={onMessage}>Написать</Button>
              <button type="button" className={styles.iconButton} onClick={onOpenInfo} aria-label="Данные">i</button>
              <button type="button" className={styles.iconButton} onClick={onCopyLink} aria-label="Ссылка">🔗</button>
              <HeaderActions variant="compact" onProfileClick={onOpenProfileMenu} />
            </div>
          </div>

          {/* Mobile: shop meta below top bar */}
          <div className={styles.mobileShopMeta}>
            {loading ? (
              <Skeleton className={styles.avatarSkeleton} variant="circle" />
            ) : shop?.avatarUrl ? (
              <img className={styles.avatar} src={resolveImageUrl(shop.avatarUrl)} alt={shop.title} />
            ) : (
              <div className={styles.avatarFallback}>{avatarText}</div>
            )}
            <div className={styles.shopMetaText}>
              {loading ? <Skeleton className={styles.titleSkeleton} /> : (
                <h2 className={styles.mobileTitle}>{shop?.title ?? 'Магазин'}</h2>
              )}
              {loading ? <Skeleton className={styles.ratingSkeleton} /> : (
                <div className={styles.ratingRow}>
                  <Rating value={shop?.rating ?? 0} count={shop?.reviewsCount ?? 0} size="sm" />
                  <span className={styles.reviewsText}>
                    {shop?.reviewsCount ? `${formatCompactNumber(shop.reviewsCount)} оценок` : 'Нет оценок'}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Mobile search overlay */}
      {searchOverlay && (
        <div className={styles.searchOverlay} onClick={closeOverlay}>
          <div className={styles.searchOverlayBox} onClick={(e) => e.stopPropagation()}>
            <form className={styles.searchOverlayForm} onSubmit={handleOverlaySubmit}>
              <span className={styles.searchOverlayIcon}><SearchIcon size={20} /></span>
              <input
                ref={overlayInputRef}
                type="search"
                placeholder="Найти в магазине"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className={styles.searchOverlayInput}
              />
              {searchValue && (
                <button type="button" className={styles.searchOverlayClear} onClick={() => onSearchChange('')}>✕</button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};
