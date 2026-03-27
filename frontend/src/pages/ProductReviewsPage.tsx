import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import type { Product, Review } from '../shared/types';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import { useProductBoardStore } from '../app/store/productBoardStore';
import { resolveImageUrl } from '../shared/lib/resolveImageUrl';
import { ImageLightbox } from '../shared/ui/ImageLightbox';

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

const unwrapPayload = <T,>(payload: unknown): T | null => {
  if (payload == null) return null;
  if (typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: T }).data ?? null;
  }
  return payload as T;
};

export const ProductReviewsPage = () => {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const addItem = useCartStore((s) => s.addItem);
  const user = useAuthStore((s) => s.user);
  const setProductBoard = useProductBoardStore((s) => s.setProduct);

  const [product, setProduct] = useState<Product | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; initialIndex: number } | null>(null);

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
    refresh,
    upsertReview
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
    const canUseHistoryBack =
      typeof window !== 'undefined' &&
      typeof window.history.state?.idx === 'number' &&
      window.history.state.idx > 0;
    const state = location.state as
      | {
          from?: { pathname: string; search?: string; hash?: string };
          fallback?: string;
        }
      | null;

    if (canUseHistoryBack) {
      navigate(-1);
      return;
    }

    if (state?.from?.pathname) {
      navigate(
        {
          pathname: state.from.pathname,
          search: state.from.search ?? '',
          hash: state.from.hash ?? ''
        },
        { replace: true }
      );
      return;
    }

    navigate(state?.fallback ?? (productId ? `/product/${productId}` : '/catalog'), {
      replace: true
    });
  }, [location.state, navigate, productId]);

  const handleReviewSubmit = useCallback(
    async (values: ReviewFormValues) => {
      if (!productId || !user) return;

      try {
        let uploadedPhotos: string[] = [];

        if (values.files.length) {
          const res = await api.returns.uploadPhotos(values.files);
          uploadedPhotos = res.data.urls ?? [];
        }

        const photos = Array.from(
          new Set([...(values.existingPhotos ?? []), ...uploadedPhotos])
        );

        const requestPayload = {
          rating: values.rating,
          pros: values.pros,
          cons: values.cons,
          comment: values.comment,
          photos: photos.length ? photos : undefined
        };

        const response = myReview
          ? await api.updateReview(myReview.id, requestPayload)
          : await api.createReview(productId, requestPayload);

        const review = unwrapPayload<Review>(unwrapPayload<unknown>(response));
        if (review?.id) {
          upsertReview(review, { prepend: true });
        } else {
          await refresh();
        }
        await refreshMyReview();

        setIsReviewModalOpen(false);
        setToastMessage(myReview ? 'Отзыв обновлён' : 'Отзыв отправлен на модерацию');
      } catch {
        setToastMessage('Не удалось отправить отзыв');
      }
    },
    [myReview, productId, user, refresh, refreshMyReview, upsertReview]
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
              onPhotoClick={(photos, initialIndex) => setPhotoViewer({ photos, initialIndex })}
            />

            {hasMore && (
              <div className={styles.loadMore}>
                <button
                  type="button"
                  className={styles.loadMoreButton}
                  onClick={loadMore}
                  disabled={status === 'loading'}
                >
                  Загрузить ещё
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
        submitting={false}
        error={null}
        fieldErrors={{}}
      />

      <ImageLightbox
        isOpen={Boolean(photoViewer)}
        onClose={() => setPhotoViewer(null)}
        initialIndex={photoViewer?.initialIndex ?? 0}
        title="Фото отзыва"
        images={(photoViewer?.photos ?? []).map((photo, index) => ({
          id: `${photo}-${index}`,
          src: resolveImageUrl(photo),
          alt: `Фото отзыва ${index + 1}`
        }))}
      />
    </section>
  );
};
