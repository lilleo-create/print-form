import { Link } from 'react-router-dom';
import type { Review } from '../../shared/types';
import type { ReviewSummary } from '../../hooks/useProductReviews';
import { Rating } from '../../shared/ui/Rating';
import styles from '../../pages/ProductPage.module.css';
import { formatReviewDate, resolveImageUrl } from './utils';

type ProductReviewsPreviewProps = {
  productId: string;
  reviews: Review[];
  summary: ReviewSummary | null;
};

export const ProductReviewsPreview = ({ productId, reviews, summary }: ProductReviewsPreviewProps) => {
  const reviewsCount = summary?.total ?? 0;

  return (
    <div className={styles.reviewsPreview}>
      <div className={styles.reviewsHeader}>
        <div>
          <h2>Отзывы</h2>
          <p className={styles.reviewsHint}>Последние впечатления покупателей</p>
        </div>
        <Link to={`/product/${productId}/reviews`} className={styles.reviewLink}>
          Смотреть все отзывы
        </Link>
      </div>

      <div className={styles.reviewsContent}>
        <div className={styles.reviewsSummary}>
          <div className={styles.summaryTop}>
            <span className={styles.summaryValue}>
              {typeof summary?.avg === 'number' ? summary.avg.toFixed(1) : '0.0'}
            </span>
            <Rating value={summary?.avg ?? 0} count={reviewsCount} />
          </div>

          <ul>
            {(summary?.counts ?? [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }))).map((item) => (
              <li key={item.rating}>
                <span>{item.rating}★</span>
                <div className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: reviewsCount ? `${(item.count / reviewsCount) * 100}%` : '0%'
                    }}
                  />
                </div>
                <span>{item.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.reviewList}>
          {reviews.length === 0 ? (
            <p className={styles.reviewsEmpty}>Пока нет отзывов.</p>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <div>
                    <strong>{(review as any).user?.name ?? 'Имя скрыто'}</strong>
                    <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                  </div>
                  <Rating value={review.rating} count={0} />
                </div>

                <div className={styles.reviewBody}>
                  <p>
                    <strong>Достоинства:</strong> {(review as any).pros}
                  </p>
                  <p>
                    <strong>Недостатки:</strong> {(review as any).cons}
                  </p>
                  <p>
                    <strong>Комментарий:</strong> {(review as any).comment}
                  </p>
                </div>

                {(((review as any).photos?.length ?? 0) > 0) ? (
                  <div className={styles.reviewPhotos}>
                    {(review as any).photos!.map((photo: string, index: number) => (
                      <img
                        src={resolveImageUrl(photo)}
                        alt={`Фото отзыва ${index + 1}`}
                        key={`${photo}-${index}`}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
