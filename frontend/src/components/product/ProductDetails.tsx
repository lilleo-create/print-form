import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '../../shared/types';
import { Rating } from '../../shared/ui/Rating';
import { Button } from '../../shared/ui/Button';
import { useCartStore } from '../../app/store/cartStore';
import styles from '../../pages/ProductPage.module.css';
import { ProductActionsInline } from '../../pages/ProductPage/components/ProductActionsInline/ProductActionsInline';
import { useFavoritesStore } from '../../features/favorites/model/useFavoritesStore';
import { ShareModal } from '../../features/share/ui/ShareModal';
import { formatReadyToShipLabel } from '../../shared/lib/dateLabels';

type ProductDetailsProps = {
  product: Product;
  baseProductId: string;
  variantProducts: Product[];
  activeVariantId: string;
  onVariantChange: (variantId: string) => void;
  ratingCount: number;
  reviewsCount: number;
};

export const ProductDetails = ({
  product,
  baseProductId,
  variantProducts,
  activeVariantId,
  onVariantChange,
  ratingCount,
  reviewsCount
}: ProductDetailsProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

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

  const openShareModal = () => {
    setIsShareOpen(true);
  };

  const readyToShipLabel = formatReadyToShipLabel(product.productionTimeHours);

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
          onShareClick={openShareModal}
        />
        <h1>{product.title}</h1>
        <div className={styles.ratingRow}>
          <Rating
            value={product.ratingAvg ?? 0}
            count={ratingCount}
            size="md"
          />
          <Link
            to={`/product/${baseProductId}/reviews`}
            className={styles.reviewLink}
          >
            {ratingCount} оценки · {reviewsCount} отзывов
          </Link>
        </div>
      </div>

      <div className={styles.priceBlock}>
        {hasGroupedVariants ? (
          <div className={styles.variantSummary}>
            <span className={styles.variantTitle}>Вариант</span>
            <span className={styles.variantText}>
              {activeVariantLabel.key}: {activeVariantLabel.value}
            </span>
          </div>
        ) : null}
        <span className={styles.price}>
          {Number((product as any).price ?? 0).toLocaleString('ru-RU')} ₽
        </span>
        <span className={styles.delivery}>
          Готово к отправке: {readyToShipLabel}
        </span>
        <span className={styles.delivery}>СДЭК: уточняется при оформлении</span>
        {'stock' in product && typeof (product as Product & { stock?: number }).stock === 'number' ? (
          <span className={styles.delivery}>В наличии: {(product as Product & { stock?: number }).stock} шт.</span>
        ) : null}
        {product.dxCm && product.dyCm && product.dzCm ? (
          <span className={styles.delivery}>
            Размер: {product.dxCm} × {product.dyCm} × {product.dzCm} см
            {product.weightGrossG ? `, вес: ${product.weightGrossG} г` : ''}
          </span>
        ) : product.weightGrossG ? (
          <span className={styles.delivery}>Вес: {product.weightGrossG} г</span>
        ) : null}
      </div>

      <div className={styles.sku}>Артикул: {(product as any).sku ?? '—'}</div>

      {hasGroupedVariants ? (
        <div className={styles.variantBlock}>
          <span>Выберите вариант</span>
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

      <div className={styles.actions}>
        <Button
          className={styles.compactActionButton}
          onClick={() => {
            addItem(product, 1);
            navigate('/checkout');
          }}
        >
          Купить сейчас
        </Button>

        <Button
          variant="secondary"
          className={styles.compactActionButton}
          onClick={() => addItem(product, 1)}
        >
          В корзину
        </Button>
      </div>

      <p className={styles.shortDescription}>
        {product.descriptionShort ?? product.description}
      </p>
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={product.title}
        image={product.image}
      />
    </div>
  );
};
