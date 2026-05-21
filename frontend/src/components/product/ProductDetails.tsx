import { useMemo } from 'react';
import type { Product } from '../../shared/types';
import { Rating } from '../../shared/ui/Rating';
import { getProductRatingMeta } from '../../shared/lib/productRating';
import styles from '../../pages/ProductPage.module.css';
import { cmToMm } from '../../shared/lib/productDimensions';
import type { SpecItem } from '../../pages/ProductPage/components/ProductSpecs/ProductSpecs';

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
  baseProductId: _baseProductId,
  variantProducts,
  activeVariantId,
  onVariantChange,
  reviewsCount,
  specs,
  specsExpanded,
  onSpecsExpandedChange
}: ProductDetailsProps) => {
  const hasGroupedVariants = variantProducts.length > 1;

  const activeVariantLabel = useMemo(
    () => ({ key: 'Цвет товара', value: product.color }),
    [product.color]
  );

  const ratingMeta = getProductRatingMeta({ ratingAvg: product.ratingAvg, ratingCount: reviewsCount });

  const previewSpecRows = [
    { label: 'Материал', value: product.material || '—' },
    { label: 'Тип печати', value: product.technology || '—' },
    {
      label: 'Размер',
      value: product.dxCm && product.dyCm && product.dzCm
        ? `${cmToMm(product.dxCm)} × ${cmToMm(product.dyCm)} × ${cmToMm(product.dzCm)} мм`
        : '—'
    },
    { label: 'Вес', value: product.weightGrossG ? `${product.weightGrossG} г` : '—' }
  ];

  const additionalSpecs = specs.filter((item) => !previewSpecRows.some((row) => row.label === item.name));

  return (
    <div className={styles.details}>
      <div className={styles.header}>
        <h1>{product.title}</h1>
        <div className={styles.ratingRow}>
          <Rating
            value={ratingMeta.hasReviews ? ratingMeta.ratingValue : 0}
            count={ratingMeta.hasReviews ? ratingMeta.ratingCount : 0}
            size="md"
          />
          {ratingMeta.hasReviews && (
            <span className={styles.reviewLink}>{ratingMeta.ratingCount} отзывов</span>
          )}
        </div>
      </div>

      {hasGroupedVariants && (
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
                className={activeVariantId === variant.id ? styles.variantActive : styles.variantButton}
                onClick={() => onVariantChange(variant.id)}
                aria-pressed={activeVariantId === variant.id}
              >
                {variant.color || variant.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.specRows}>
        {previewSpecRows.map((row) => (
          <p key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </p>
        ))}
        <div
          id="product-full-specs"
          className={specsExpanded ? styles.expandedSpecs : styles.expandedSpecsCollapsed}
          aria-hidden={!specsExpanded}
        >
          {additionalSpecs.map((item, index) => (
            <p key={`${item.name}-${index}`}>
              <span>{item.name}</span>
              <strong>{item.value}</strong>
            </p>
          ))}
        </div>
        <button
          type="button"
          className={styles.allSpecsControl}
          onClick={() => onSpecsExpandedChange(!specsExpanded)}
          aria-expanded={specsExpanded}
          aria-controls="product-full-specs"
        >
          {specsExpanded ? 'Скрыть' : 'Все характеристики ›'}
        </button>
      </div>
    </div>
  );
};
