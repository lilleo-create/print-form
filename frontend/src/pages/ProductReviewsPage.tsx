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
import { ReviewFilters, ReviewScope, useProductReviews } from './product-reviews/hooks/useProductReviews';
import { useMyReview } from './product-reviews/hooks/useMyReview';
import styles from './ProductReviewsPage.module.css';

const DEFAULT_FILTERS: ReviewFilters = {
  helpful: false,
  withMedia: false,
  high: false,
  low: false,
  new: true
};

type ReviewFieldKey = 'pros' | 'cons' | 'comment' | 'photos';
type ReviewFieldErrors = Partial<Record<ReviewFieldKey, string>>;

function extractValidationErrors(
  err: unknown
): { fieldErrors: ReviewFieldErrors; message: string | null } {
  const anyErr = err as any;

  // Поддерживаем разные форматы, потому что api-клиент может класть payload по-разному
  const payload = anyErr?.payload ?? anyErr?.response?.data ?? anyErr?.data ?? anyErr;
  const errorObj = payload?.error;
  const issues = errorObj?.issues;

  if (errorObj?.code !== 'VALIDATION_ERROR' || !Array.isArray(issues)) {
    return { fieldErrors: {}, message: null };
  }

  const fieldErrors: ReviewFieldErrors = {};

  for (const issue of issues) {
    const path0 = Array.isArray(issue?.path) ? issue.path[0] : undefined;
    const msg = typeof issue?.message === 'string' ? issue.message : 'Ошибка валидации';

    if (path0 === 'pros') fieldErrors.pros = msg;
    if (path0 === 'cons') fieldErrors.cons = msg;
    if (path0 === 'comment') fieldErrors.comment = msg;
    if (path0 === 'photos') fieldErrors.photos = msg;
  }

  const first = issues[0]?.message;
  return { fieldErrors, message: typeof first === 'string' ? first : null };
}

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
  const [submitFieldErrors, setSubmitFieldErrors] = useState<ReviewFieldErrors>({});
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

  const publicProductIds = useMemo(() => (id ? [id] : []), [id]);

  const { reviews, summary, status, error, hasMore, loadMore, refresh } = useProductReviews(id, {
    filters,
    scope,
    productIds: publicProductIds
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
      setSubmitFieldErrors({});

      // Локальная проверка, чтобы не шмалять в бек без смысла
      if (payload.comment.trim().length < 10) {
        setSubmitting(false);
        setSubmitFieldErrors({ comment: 'Комментарий должен быть минимум 10 символов.' });
        setSubmitError('Проверьте поле "Комментарий".');
        return;
      }

      try {
        let uploadedPhotos: string[] = [];

        // upload новых файлов (используем уже существующую механику возвратов)
        if (payload.files.length > 0) {
          const uploadResponse = await api.returns.uploadPhotos(payload.files);
          uploadedPhotos = uploadResponse.data.urls ?? [];
        }

        // итоговые фото: старые + новые, без дублей
        const photos = Array.from(
          new Set([...(payload.existingPhotos ?? []), ...uploadedPhotos])
        ).filter(Boolean);

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
      } catch (err) {
        const extracted = extractValidationErrors(err);

        if (Object.keys(extracted.fieldErrors).length > 0) {
          setSubmitFieldErrors(extracted.fieldErrors);
          setSubmitError(extracted.message ?? 'Проверьте поля формы.');
        } else {
          setSubmitError('Не удалось отправить отзыв. Попробуйте снова.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [id, refresh, refreshMyReview, user]
  );

  if (!id) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p>Не удалось определить товар для отзывов.</p>
        </div>
      </section>
    );
  }

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
            <ReviewsFilters scope={scope} onScopeChange={setScope} filters={filters} onFiltersChange={setFilters} />

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

            <ReviewsList reviews={reviews} status={status} error={error} onPhotoClick={setActivePhoto} />

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
        fieldErrors={submitFieldErrors}
      />

      {activePhoto && (
        <div className={styles.photoModal} onClick={() => setActivePhoto(null)}>
          <div className={styles.photoModalContent} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.photoModalClose} onClick={() => setActivePhoto(null)}>
              ✕
            </button>
            <img src={activePhoto} alt="Фото отзыва" />
          </div>
        </div>
      )}
    </section>
  );
};
