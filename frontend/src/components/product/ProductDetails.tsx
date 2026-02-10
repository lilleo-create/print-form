import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product, ProductVariant } from '../../shared/types';
import { Rating } from '../../shared/ui/Rating';
import { Button } from '../../shared/ui/Button';
import { useCartStore } from '../../app/store/cartStore';
import styles from '../../pages/ProductPage.module.css';
import { formatDeliveryDate } from './utils';
import { useFavorite } from './hooks/useFavorite';
import { ProductActionsRow } from './ProductActionsRow';
import { ShareModal } from './ShareModal';

type ProductDetailsProps = {
  product: Product;
  ratingCount: number;
  reviewsCount: number;
};

export const ProductDetails = ({ product, ratingCount, reviewsCount }: ProductDetailsProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const { isFavorite, isLoading, toggleFavorite } = useFavorite(product.id);
  const [isShareOpen, setShareOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const variants = useMemo<ProductVariant[]>(() => product.variants ?? [], [product.variants]);
  const [selectedVariant, setSelectedVariant] = useState<string>('');

  useEffect(() => {
    setSelectedVariant('');
  }, [product.id]);

  const handleVariantChange = (variantId: string) => {
    setSelectedVariant(variantId);

    const variant = variants.find((item) => item.id === variantId) as ProductVariant | undefined;
    const nextProductId = variant?.productId ?? variantId;

    if (nextProductId && nextProductId !== product.id) {
      navigate(`/product/${nextProductId}`);
    }
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleToggleFavorite = async () => {
    const result = await toggleFavorite();
    if (!result.success) {
      setToastMessage('Не удалось обновить избранное');
      return;
    }
    setToastMessage(result.next ? 'Добавлено в избранное' : 'Удалено из избранного');
  };

  return (
    <div className={styles.details}>
      <div className={styles.header}>
        <h1>{product.title}</h1>
        <div className={styles.ratingRow}>
          <Rating value={product.ratingAvg ?? 0} count={ratingCount} size="md" />
          <Link to={`/product/${product.id}/reviews`} className={styles.reviewLink}>
            {ratingCount} оценки · {reviewsCount} отзывов
          </Link>
        </div>
      </div>

      <ProductActionsRow
        isFavorite={isFavorite}
        isLoading={isLoading}
        onToggleFavorite={handleToggleFavorite}
        onShare={() => setShareOpen(true)}
      />

      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}

      <div className={styles.priceBlock}>
        <span className={styles.price}>
          {Number((product as any).price ?? 0).toLocaleString('ru-RU')} ₽
        </span>
        <span className={styles.delivery}>
          Ближайшая дата доставки: {formatDeliveryDate(product.deliveryDateNearest)}
        </span>
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
          className={styles.actionButtonCompact}
          onClick={() => {
            addItem(product, 1);
            navigate('/checkout');
          }}
        >
          Купить сейчас
        </Button>

        <Button
          variant="secondary"
          className={styles.actionButtonCompact}
          onClick={() => addItem(product, 1)}
        >
          В корзину
        </Button>
      </div>

      <p className={styles.shortDescription}>{product.descriptionShort ?? product.description}</p>

      <ShareModal
        product={product}
        isOpen={isShareOpen}
        onClose={() => setShareOpen(false)}
        onToast={setToastMessage}
      />
    </div>
  );
};
