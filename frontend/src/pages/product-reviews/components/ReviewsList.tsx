import type { Review } from '../../../shared/types';
import { Rating } from '../../../shared/ui/Rating';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import styles from './ReviewsList.module.css';

type ReviewsListProps = {
  reviews: Review[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  onPhotoClick: (photo: string) => void;
};

const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

export const ReviewsList = ({
  reviews,
  status,
  error,
  onPhotoClick
}: ReviewsListProps) => {
  if (error) {
    return <p className={styles.empty}>{error}</p>;
  }

  if (status === 'loading' && reviews.length === 0) {
    return <p className={styles.empty}>Загрузка отзывов…</p>;
  }

  if (reviews.length === 0) {
    return <p className={styles.empty}>Пока нет отзывов.</p>;
  }

  return (
    <div className={styles.list}>
      {reviews.map((review) => {
        const reviewPhotos = review.photos ?? [];

        return (
          <article key={review.id} className={styles.card}>
            <div className={styles.top}>
              <div>
                <strong>{review.user?.name ?? 'Пользователь'}</strong>
                <span className={styles.date}>
                  {formatReviewDate(review.createdAt)}
                </span>
              </div>
              <Rating value={review.rating} count={0} />
            </div>

            <div className={styles.body}>
              <p>
                <strong>Достоинства:</strong> {review.pros}
              </p>
              <p>
                <strong>Недостатки:</strong> {review.cons}
              </p>
              <p>
                <strong>Комментарий:</strong> {review.comment}
              </p>
            </div>

            {reviewPhotos.length > 0 && (
              <div className={styles.photos}>
                {reviewPhotos.map((photo) => (
                  <button
                    key={photo}
                    type="button"
                    className={styles.photoButton}
                    onClick={() => onPhotoClick(photo)}
                  >
                    <img
                      src={resolveImageUrl(photo)}
                      alt="Фото отзыва"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <button type="button">Ответить</button>
              <div className={styles.reaction}>
                <span>👍 {review.likesCount ?? 0}</span>
                <span>👎 {review.dislikesCount ?? 0}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};
