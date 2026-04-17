import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Product } from '../../shared/types';
import { Rating } from '../../shared/ui/Rating';
import styles from '../../pages/ProductPage.module.css';
import { ProductActionsInline } from '../../pages/ProductPage/components/ProductActionsInline/ProductActionsInline';
import { useFavoritesStore } from '../../features/favorites/model/useFavoritesStore';
import { ShareModal } from '../../features/share/ui/ShareModal';
import { cmToMm } from '../../shared/lib/productDimensions';
import { getProductRatingMeta } from '../../shared/lib/productRating';
import { ProductSpecs, type SpecItem } from '../../pages/ProductPage/components/ProductSpecs/ProductSpecs';

type ProductDetailsProps = {
  product: Product;
  baseProductId: string;
  variantProducts: Product[];
  activeVariantId: string;
  onVariantChange: (variantId: string) => void;
  reviewsCount: number;
  specs: SpecItem[];
  specsExpanded: boolean;
  onSpecsExpandedChange: (expanded: boolean) => void;
};

export const ProductDetails = ({
  product,
  baseProductId,
  variantProducts,
  activeVariantId,
  onVariantChange,
  reviewsCount,
  specs,
  specsExpanded,
  onSpecsExpandedChange
}: ProductDetailsProps) => {
  const location = useLocation();

  const [isShareOpen, setIsShareOpen] = useState(false);
  const isFavorite = useFavoritesStore((state) => state.isFavorite(product.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const fetchFavorites = useFavoritesStore((state) => state.fetchFavorites);

  const hasGroupedVariants = variantProducts.length > 1;
  const activeVariantLabel = useMemo(
    () => ({
      key: 'Цвет товара',
      value: product.color
    }),
    [product.color]
  );

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites, product.id]);

  const ratingMeta = getProductRatingMeta({
    ratingAvg: product.ratingAvg,
    ratingCount: reviewsCount
  });

  return (
    <div className={styles.details}>
      <div className={styles.header}>
        <ProductActionsInline
          isFavorite={isFavorite}
          onFavoriteClick={() => {
            void toggleFavorite(product.id, {
              id: product.id,
              title: product.title,
              price: product.price,
              image: product.image,
              ratingAvg: product.ratingAvg,
              ratingCount: product.ratingCount,
              shortSpec: product.descriptionShort
            });
          }}
          onShareClick={() => setIsShareOpen(true)}
        />
        <h1>{product.title}</h1>
        <div className={styles.ratingRow}>
          {ratingMeta.hasReviews ? (
            <>
              <Rating
                value={ratingMeta.ratingValue}
                count={ratingMeta.ratingCount}
                size="md"
              />
              <Link
                to={`/product/${baseProductId}/reviews`}
                className={styles.reviewLink}
                state={{
                  from: {
                    pathname: location.pathname,
                    search: location.search,
                    hash: location.hash
                  },
                  fallback: `/product/${baseProductId}`
                }}
              >
                {ratingMeta.ratingCount} отзывов
              </Link>
            </>
          ) : (
            <span className={styles.noReviewsText}>Пока нет отзывов</span>
          )}
        </div>
      </div>

      <p className={styles.shortDescription}>
        {product.descriptionShort ?? product.description}
      </p>

      {hasGroupedVariants ? (
        <div className={styles.variantBlock}>
          <span className={styles.variantTitle}>Вариант</span>
          <span className={styles.variantText}>
            {activeVariantLabel.key}: {activeVariantLabel.value}
          </span>
          <div className={styles.variantList}>
            {variantProducts.map((variant) => (
              <button
                type="button"
                key={variant.id}
                className={
                  activeVariantId === variant.id
                    ? styles.variantActive
                    : styles.variantButton
                }
                onClick={() => onVariantChange(variant.id)}
                aria-pressed={activeVariantId === variant.id}
              >
                {variant.color || variant.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.specRows}>
        <p><span>Материал</span><strong>{product.material || '—'}</strong></p>
        <p><span>Тип печати</span><strong>{product.technology || '—'}</strong></p>
        {product.dxCm && product.dyCm && product.dzCm ? (
          <p><span>Размер</span><strong>{cmToMm(product.dxCm)} × {cmToMm(product.dyCm)} × {cmToMm(product.dzCm)} мм</strong></p>
        ) : (
          <p><span>Размер</span><strong>—</strong></p>
        )}
        <p><span>Вес</span><strong>{product.weightGrossG ? `${product.weightGrossG} г` : '—'}</strong></p>
        <button
          type="button"
          className={styles.allSpecsControl}
          onClick={() => onSpecsExpandedChange(!specsExpanded)}
          aria-expanded={specsExpanded}
          aria-controls="product-full-specs"
        >
          {specsExpanded ? 'Скрыть характеристики' : 'Все характеристики'}
        </button>
      </div>

      {specsExpanded ? (
        <div className={styles.fullSpecs} id="product-full-specs">
          <ProductSpecs items={specs} expanded={true} onExpandedChange={onSpecsExpandedChange} />
        </div>
      ) : null}

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={product.title}
        image={product.image}
      />
    </div>
  );
};
