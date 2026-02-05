import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import type { Product } from '../shared/types';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import { useProductBoardStore } from '../app/store/productBoardStore';
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
  const { id } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
  const setProductBoard = useProductBoardStore((state) => state.setProduct);
  const [product, setProduct] = useState<Product | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [scope, setScope] = useState<ReviewScope>('all');
  const [filters, setFilters] = useState<ReviewFilters>(DEFAULT_FILTERS);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getProduct(id).then((response) => setProduct(response.data));
  }, [id]);

  useEffect(() => {
    if (product) {
      setProductBoard(product);
    }
  }, [product, setProductBoard]);

  useEffect(() => () => setProductBoard(null), [setProductBoard]);

  const scopedProductIds = useMemo(() => {
    if (!product) return [];
    const variantIds =
      product.variants?.map((variant) => variant.productId).filter(Boolean) as string[] | undefined;
    return Array.from(new Set([product.id, ...(variantIds ?? [])]));
  }, [product]);

  const {
    reviews,
    summary,
    status,
    error,
    hasMore,
    loadMore,
    refresh
  } = useProductReviews(id, {
    filters,
    scope,
    productIds: scopedProductIds
  });

  const { hasPurchased, myReview, refresh: refreshMyReview } = useMyReview({
    productIds: scopedProductIds,
    enabled: Boolean(id)
  });

  const ratingValue = summary?.avg ?? product?.ratingAvg ?? 0;
  const totalReviews = summary?.total ?? 0;
  const ratingCount = product?.ratingCount ?? totalReviews;

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (product) {
      navigate(`/product/${product.id}`);
    }
  }, [navigate, product]);

  const handleReviewSubmit = useCallback(
    async (payload: ReviewFormValues) => {
      if (!id || !user) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        let uploadedPhotos: string[] = [];
        if (payload.files.length > 0) {
          const uploadResponse = await api.returns.uploadPhotos(payload.files);
          uploadedPhotos = uploadResponse.data.urls ?? [];
        }
        const photos = [...payload.existingPhotos, ...uploadedPhotos].filter(Boolean);
        await api.createReview(id, {
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
        setSubmitError('Не удалось отправить отзыв. Попробуйте снова.');
      } finally {
        setSubmitting(false);
      }
    },
    [id, refresh, refreshMyReview, user]
  );

  if (!product) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p>Загрузка...</p>
        </div>
      </section>
    );
  }

  const canReview = Boolean(user && hasPurchased);
  const reviewActionLabel = myReview ? 'Изменить отзыв' : 'Оставить отзыв';

  return (
    <section className={styles.page}>
      <div className="container">
        <ProductReviewsHeader
          product={product}
          ratingValue={ratingValue}
          ratingCount={ratingCount}
          reviewsCount={totalReviews}
          onBack={handleBack}
          onAddToCart={() => addItem(product, 1)}
          onBuyNow={() => {
            addItem(product, 1);
            navigate('/checkout');
          }}
        />

        {toastMessage && (
          <div className={styles.toast} role="status">
            {toastMessage}
          </div>
        )}

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <ReviewsSummary
              summary={summary}
              total={totalReviews}
              onAction={() => setIsReviewModalOpen(true)}
              actionLabel={reviewActionLabel}
              canReview={canReview}
            />
          </aside>

          <div className={styles.main}>
            <ReviewsFilters
              scope={scope}
              onScopeChange={setScope}
              filters={filters}
              onFiltersChange={setFilters}
            />

            <div className={styles.mediaStrip}>
              {(summary?.photos ?? []).length === 0 ? (
                <p className={styles.empty}>Фото из отзывов пока нет.</p>
              ) : (
                <div className={styles.mediaRow}>
                  {(summary?.photos ?? []).map((photo) => (
                    <button
                      type="button"
                      className={styles.mediaItem}
                      key={photo}
                      onClick={() => setActivePhoto(photo)}
                    >
                      <img src={photo} alt="Фото из отзыва" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ReviewsList
              reviews={reviews}
              status={status}
              error={error}
              onPhotoClick={setActivePhoto}
            />

            {hasMore && (
              <div className={styles.loadMore}>
                <button
                  type="button"
                  className={styles.loadMoreButton}
                  onClick={loadMore}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Загрузка...' : 'Загрузить ещё'}
                </button>
              </div>
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
        submitting={submitting}
        error={submitError}
      />

      {activePhoto && (
        <div className={styles.photoModal} onClick={() => setActivePhoto(null)}>
          <div className={styles.photoModalContent} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.photoModalClose}
              onClick={() => setActivePhoto(null)}
            >
              ✕
            </button>
            <img src={activePhoto} alt="Фото отзыва" />
          </div>
        </div>
      )}
    </section>
  );
};
