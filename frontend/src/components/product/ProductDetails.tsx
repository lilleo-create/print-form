import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product, ProductVariant } from '../../shared/types';
import { Rating } from '../../shared/ui/Rating';
import { Button } from '../../shared/ui/Button';
import { useCartStore } from '../../app/store/cartStore';
import styles from '../../pages/ProductPage.module.css';
import { formatDeliveryDate } from '../../shared/lib/formatDeliveryDate';
import { ProductActionsInline } from '../../pages/ProductPage/components/ProductActionsInline/ProductActionsInline';
import { useFavoritesStore } from '../../features/favorites/model/useFavoritesStore';
import { ShareModal } from '../../features/share/ui/ShareModal';

type ProductDetailsProps = {
  product: Product;
  ratingCount: number;
  reviewsCount: number;
};

export const ProductDetails = ({ product, ratingCount, reviewsCount }: ProductDetailsProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const variants = useMemo<ProductVariant[]>(() => product.variants ?? [], [product.variants]);
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const isFavorite = useFavoritesStore((state) => state.isFavorite(product.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const fetchFavorites = useFavoritesStore((state) => state.fetchFavorites);

  useEffect(() => {
    setSelectedVariant('');
    void fetchFavorites();
  }, [fetchFavorites, product.id]);

  const handleVariantChange = (variantId: string) => {
    setSelectedVariant(variantId);

    const variant = variants.find((item) => item.id === variantId) as ProductVariant | undefined;
    const nextProductId = variant?.productId ?? variantId;

    if (nextProductId && nextProductId !== product.id) {
      navigate(`/product/${nextProductId}`);
    }
  };

  const openShareModal = () => {
    setIsShareOpen(true);
  };

  const deliveryLabel = formatDeliveryDate(product.deliveryDateNearest);

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
          <Rating value={product.ratingAvg ?? 0} count={ratingCount} size="md" />
          <Link to={`/product/${product.id}/reviews`} className={styles.reviewLink}>
            {ratingCount} оценки · {reviewsCount} отзывов
          </Link>
        </div>
      </div>

      <div className={styles.priceBlock}>
        <span className={styles.price}>
          {Number((product as any).price ?? 0).toLocaleString('ru-RU')} ₽
        </span>
        {deliveryLabel ? <span className={styles.delivery}>Ближайшая дата доставки: {deliveryLabel}</span> : null}
      </div>

      <div className={styles.sku}>Артикул: {(product as any).sku ?? '—'}</div>

      {variants.length > 0 ? (
        <div className={styles.variantBlock}>
          <span>Варианты</span>
          <div className={styles.variantList}>
            {variants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                className={selectedVariant === variant.id ? styles.variantActive : styles.variantButton}
                onClick={() => handleVariantChange(variant.id)}
              >
                {variant.name}
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

        <Button variant="secondary" className={styles.compactActionButton} onClick={() => addItem(product, 1)}>
          В корзину
        </Button>
      </div>

      <p className={styles.shortDescription}>{product.descriptionShort ?? product.description}</p>
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={product.title}
        image={product.image}
      />
    </div>
  );
};
