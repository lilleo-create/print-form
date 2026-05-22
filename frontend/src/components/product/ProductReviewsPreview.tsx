import { Link, useLocation } from 'react-router-dom';
import type { Product } from '../../shared/types';
import type { Review } from '../../shared/types';
import type { ReviewSummary } from '../../hooks/useProductReviews';
import { Rating } from '../../shared/ui/Rating';
import styles from '../../pages/ProductPage.module.css';
import { formatReviewDate } from './utils';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { getReviewAuthorName, normalizeReviewPhotoUrl, type ReviewPhotoLike } from '../../shared/lib/reviews';

type ProductReviewsPreviewProps = {
  productId: string;
  product: Product;
  reviews: Review[];
  summary: ReviewSummary | null;
};

export const ProductReviewsPreview = ({ productId, reviews }: ProductReviewsPreviewProps) => {
  const location = useLocation();
  const isSingleReview = reviews.length === 1;

  return (
    <div className={styles.reviewsPreview}>
      <Link
        to={`/product/${productId}/reviews`}
        className={styles.reviewLink}
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash
          },
          fallback: `/product/${productId}`
        }}
      >
        Смотреть все отзывы →
      </Link>

      <div className={`${styles.reviewList} ${isSingleReview ? styles.reviewListSingle : ''}`}>
        {reviews.length === 0 ? (
          <p className={styles.reviewsEmpty}>Пока нет отзывов.</p>
        ) : (
          reviews.map((review) => {
            const reviewData = review as Review & {
              pros?: string;
              cons?: string;
              comment?: string;
              photos?: ReviewPhotoLike[];
            };

            const authorName = getReviewAuthorName(review);
            const initials = authorName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((w: string) => w[0])
              .join('');

            return (
              <article key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <div className={styles.reviewAuthorRow}>
                    <div className={styles.reviewAvatar}>{initials || '?'}</div>
                    <div className={styles.reviewAuthorInfo}>
                      <strong>{authorName}</strong>
                      <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                      {review.isOwn && review.moderationStatus === 'PENDING' ? (
                        <span className={styles.pendingBadge}>
                          {review.moderationStatusLabelRu?.trim() || 'На модерации'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Rating value={review.rating} count={0} />
                </div>

                <div className={styles.reviewBody}>
                  {reviewData.pros ? (
                    <p><strong>Достоинства:</strong> {reviewData.pros}</p>
                  ) : null}
                  {reviewData.cons ? (
                    <p><strong>Недостатки:</strong> {reviewData.cons}</p>
                  ) : null}
                  {reviewData.comment ? (
                    <p><strong>Комментарий:</strong> {reviewData.comment}</p>
                  ) : null}
                </div>

                {(reviewData.photos?.length ?? 0) > 0 ? (
                  <div className={styles.reviewPhotos}>
                    {reviewData.photos!
                      .map((photo: ReviewPhotoLike) => normalizeReviewPhotoUrl(photo))
                      .filter(Boolean)
                      .map((photo: string, index: number) => (
                        <img
                          src={resolveImageUrl(photo)}
                          alt={`Фото отзыва ${index + 1}`}
                          key={`${photo}-${index}`}
                        />
                      ))}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
