import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import type { Product } from '../shared/types';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import { useProductBoardStore } from '../app/store/productBoardStore';
import { resolveImageUrl } from '../shared/lib/resolveImageUrl';

import { ProductReviewsHeader } from './product-reviews/components/ProductReviewsHeader';
import { ReviewsSummary } from './product-reviews/components/ReviewsSummary';
import { ReviewsFilters } from './product-reviews/components/ReviewsFilters';
import { ReviewsList } from './product-reviews/components/ReviewsList';
import { ReviewFormModal, ReviewFormValues } from './product-reviews/components/ReviewFormModal';

import {
  ReviewFilters,
  ReviewScope,
  useProductReviews
} from './product-reviews/hooks/useProductReviews';
import { useMyReview } from './product-reviews/hooks/useMyReview';

import styles from './ProductReviewsPage.module.css';

const DEFAULT_FILTERS: ReviewFilters = {
  helpful: false,
  withMedia: false,
  high: false,
  low: false,
  new: true
};

export const ProductReviewsPage = () => {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const addItem = useCartStore((s) => s.addItem);
  const user = useAuthStore((s) => s.user);
  const setProductBoard = useProductBoardStore((s) => s.setProduct);

  const [product, setProduct] = useState<Product | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const [scope, setScope] = useState<ReviewScope>('all');
  const [filters, setFilters] = useState<ReviewFilters>(DEFAULT_FILTERS);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /* ---------- product ---------- */
  useEffect(() => {
    if (!productId) return;
    api.getProduct(productId).then((res) => setProduct(res.data));
  }, [productId]);

  useEffect(() => {
    if (product) setProductBoard(product);
    return () => setProductBoard(null);
  }, [product, setProductBoard]);

  /* ---------- reviews ---------- */
  const productIds = useMemo(() => {
    if (!productId) return [];
    return [productId];
  }, [productId]);

  const {
    reviews,
    summary,
    status,
    error,
    hasMore,
    loadMore,
    refresh
  } = useProductReviews(productId, {
    productIds,
    filters,
    scope
  });

  const {
    hasPurchased,
    myReview,
    refresh: refreshMyReview
  } = useMyReview({
    productIds,
    enabled: Boolean(productId)
  });

  /* ---------- ui helpers ---------- */
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleReviewSubmit = useCallback(
    async (payload: ReviewFormValues) => {
      if (!productId || !user) return;

      try {
        let uploadedPhotos: string[] = [];

        if (payload.files.length) {
          const res = await api.returns.uploadPhotos(payload.files);
          uploadedPhotos = res.data.urls ?? [];
        }

        const photos = Array.from(
          new Set([...(payload.existingPhotos ?? []), ...uploadedPhotos])
        );

        await api.createReview(productId, {
          rating: payload.rating,
          pros: payload.pros,
          cons: payload.cons,
          comment: payload.comment,
          photos: photos.length ? photos : undefined
        });

        await refresh();
        await refreshMyReview();

        setIsReviewModalOpen(false);
        setToastMessage('Отзыв отправлен на модерацию');
      } catch {
        setToastMessage('Не удалось отправить отзыв');
      }
    },
    [productId, user, refresh, refreshMyReview]
  );

  if (!product) {
    return (
      <section className={styles.page}>
        <div className="container">Загрузка…</div>
      </section>
    );
  }
  return (
    <section className={styles.page}>
      <div className="container">
        <ProductReviewsHeader
          product={product}
          ratingValue={summary?.avg ?? product.ratingAvg ?? 0}
          ratingCount={summary?.total ?? product.ratingCount ?? 0}
          reviewsCount={summary?.total ?? 0}
          onBack={handleBack}
          onAddToCart={() => addItem(product, 1)}
          onBuyNow={() => {
            addItem(product, 1);
            navigate('/checkout');
          }}
        />

        {toastMessage && <div className={styles.toast}>{toastMessage}</div>}

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <ReviewsSummary
              product={product}
              summary={summary}
              total={summary?.total ?? 0}
              canReview={Boolean(user && hasPurchased)}
              actionLabel={myReview ? 'Изменить отзыв' : 'Оставить отзыв'}
              onAction={() => setIsReviewModalOpen(true)}
            />
          </aside>

          <div className={styles.main}>
            <ReviewsFilters
              scope={scope}
              onScopeChange={setScope}
              filters={filters}
              onFiltersChange={setFilters}
            />

            <ReviewsList
              reviews={reviews}
              status={status}
              error={error}
              onPhotoClick={setActivePhoto}
            />

            {hasMore && (
              <button onClick={loadMore} disabled={status === 'loading'}>
                Загрузить ещё
              </button>
            )}
          </div>
        </div>
      </div>

      <ReviewFormModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        product={product}
        initialReview={myReview ?? null}
        onSubmit={handleReviewSubmit}
        submitting={false}
        error={null}
        fieldErrors={{}}
      />

      {activePhoto && (
        <div className={styles.photoModal} onClick={() => setActivePhoto(null)}>
          <img src={resolveImageUrl(activePhoto)} alt="Фото отзыва" />
        </div>
      )}
    </section>
  );
};
