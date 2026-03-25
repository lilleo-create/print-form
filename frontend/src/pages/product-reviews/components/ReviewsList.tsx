import type { Review } from '../../../shared/types';
import { useMemo, useState } from 'react';
import { api } from '../../../shared/api';
import { normalizeApiError } from '../../../shared/api/client';
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
  const [localReviews, setLocalReviews] = useState<Record<string, Review>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [replyComposerOpen, setReplyComposerOpen] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<string, boolean>>({});
  const [reactionSubmitting, setReactionSubmitting] = useState<Record<string, boolean>>({});
  const [reactionErrors, setReactionErrors] = useState<Record<string, string>>({});

  const mergedReviews = useMemo(
    () => reviews.map((review) => localReviews[review.id] ?? review),
    [localReviews, reviews]
  );

  const updateReview = (reviewId: string, updater: (review: Review) => Review) => {
    const source = mergedReviews.find((item) => item.id === reviewId);
    if (!source) return;
    setLocalReviews((prev) => ({
      ...prev,
      [reviewId]: updater(source)
    }));
  };

  const handleReaction = async (review: Review, reaction: 'LIKE' | 'DISLIKE') => {
    const productId = review.productId;
    if (!productId) {
      setReactionErrors((prev) => ({
        ...prev,
        [review.id]: 'Не удалось отправить реакцию: не найден productId.'
      }));
      return;
    }

    setReactionErrors((prev) => {
      if (!prev[review.id]) return prev;
      const next = { ...prev };
      delete next[review.id];
      return next;
    });

    const currentReaction = review.currentUserReaction ?? null;
    const nextReaction = currentReaction === reaction ? null : reaction;

    const currentLikes = review.reactions?.likes ?? review.likesCount ?? 0;
    const currentDislikes = review.reactions?.dislikes ?? review.dislikesCount ?? 0;

    const optimisticLikes =
      nextReaction === 'LIKE'
        ? currentReaction === 'LIKE'
          ? currentLikes - 1
          : currentLikes + 1
        : currentReaction === 'LIKE'
          ? currentLikes - 1
          : currentLikes;

    const optimisticDislikes =
      nextReaction === 'DISLIKE'
        ? currentReaction === 'DISLIKE'
          ? currentDislikes - 1
          : currentDislikes + 1
        : currentReaction === 'DISLIKE'
          ? currentDislikes - 1
          : currentDislikes;

    updateReview(review.id, (item) => ({
      ...item,
      currentUserReaction: nextReaction,
      reactions: {
        likes: Math.max(0, optimisticLikes),
        dislikes: Math.max(0, optimisticDislikes)
      }
    }));

    try {
      setReactionSubmitting((prev) => ({ ...prev, [review.id]: true }));
      setReactionErrors((prev) => ({ ...prev, [review.id]: '' }));
      const response = await api.setReviewReaction(productId, review.id, nextReaction);
      const payload = response.data?.data ?? response.data;
      updateReview(review.id, (item) => ({
        ...item,
        currentUserReaction: payload.currentUserReaction ?? nextReaction,
        reactions: payload.reactions ?? item.reactions
      }));
    } catch (error) {
      const normalized = normalizeApiError(error);
      const status = normalized.status;
      const readableError =
        status === 401
          ? 'Поставить реакцию могут только авторизованные пользователи.'
          : status === 403
            ? 'У вас нет доступа к изменению реакции на этот отзыв.'
            : status === 404
              ? 'Отзыв не найден. Обновите страницу и попробуйте ещё раз.'
              : status === 405
                ? 'Метод запроса не поддерживается сервером.'
                : 'Не удалось сохранить реакцию. Попробуйте позже.';

      setReactionErrors((prev) => ({ ...prev, [review.id]: readableError }));
      updateReview(review.id, (item) => ({
        ...item,
        currentUserReaction: currentReaction,
        reactions: {
          likes: currentLikes,
          dislikes: currentDislikes
        }
      }));
    } finally {
      setReactionSubmitting((prev) => ({ ...prev, [review.id]: false }));
    }
  };

  const loadReplies = async (review: Review) => {
    if (review.replies && review.replies.length > 0) return;
    if (!review.productId) return;

    setLoadingReplies((prev) => ({ ...prev, [review.id]: true }));
    try {
      const response = await api.getReviewReplies(review.productId, review.id, { limit: 20, page: 1 });
      const replies = response.data?.data ?? [];
      updateReview(review.id, (item) => ({
        ...item,
        replies,
        repliesCount: Math.max(item.repliesCount ?? 0, replies.length)
      }));
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [review.id]: false }));
    }
  };

  const toggleReplies = async (review: Review) => {
    const isExpanded = expandedReplies[review.id] ?? false;
    if (!isExpanded && (!review.replies || review.replies.length === 0)) {
      await loadReplies(review);
    }
    setExpandedReplies((prev) => ({ ...prev, [review.id]: !isExpanded }));
  };

  const submitReply = async (review: Review) => {
    const text = (replyDrafts[review.id] ?? '').trim();
    if (!text || !review.productId) return;

    setReplySubmitting((prev) => ({ ...prev, [review.id]: true }));
    try {
      const response = await api.createReviewReply(review.productId, review.id, text);
      const reply = response.data?.data ?? response.data;
      updateReview(review.id, (item) => ({
        ...item,
        replies: [...(item.replies ?? []), reply],
        repliesCount: (item.repliesCount ?? item.replies?.length ?? 0) + 1
      }));
      setReplyDrafts((prev) => ({ ...prev, [review.id]: '' }));
      setExpandedReplies((prev) => ({ ...prev, [review.id]: true }));
    } finally {
      setReplySubmitting((prev) => ({ ...prev, [review.id]: false }));
    }
  };

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
      {mergedReviews.map((review) => {
        const reviewPhotos = review.photos ?? [];
        const replies = review.replies ?? [];
        const sellerReply = replies.find((reply) => reply.isCurrentStoreReply);
        const visibleReplies = expandedReplies[review.id]
          ? replies
          : sellerReply
            ? [sellerReply]
            : [];
        const totalRepliesCount = review.repliesCount ?? replies.length;
        const hasReplies = totalRepliesCount > 0;
        const likes = review.reactions?.likes ?? review.likesCount ?? 0;
        const dislikes = review.reactions?.dislikes ?? review.dislikesCount ?? 0;
        const buyerName = review.buyerNickname ?? review.user?.name ?? 'Покупатель';

        return (
          <article key={review.id} className={styles.card}>
            <div className={styles.top}>
              <div>
                <strong>{buyerName}</strong>
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
              <button
                type="button"
                onClick={() =>
                  setReplyComposerOpen((prev) => ({
                    ...prev,
                    [review.id]: !prev[review.id]
                  }))
                }
              >
                Ответить
              </button>
              <div className={styles.reaction}>
                <button
                  type="button"
                  className={review.currentUserReaction === 'LIKE' ? styles.reactionActive : ''}
                  onClick={() => handleReaction(review, 'LIKE')}
                  disabled={reactionSubmitting[review.id]}
                >
                  👍 {likes}
                </button>
                <button
                  type="button"
                  className={review.currentUserReaction === 'DISLIKE' ? styles.reactionActive : ''}
                  onClick={() => handleReaction(review, 'DISLIKE')}
                  disabled={reactionSubmitting[review.id]}
                >
                  👎 {dislikes}
                </button>
              </div>
            </div>

            {reactionErrors[review.id] && (
              <p className={styles.reactionError}>{reactionErrors[review.id]}</p>
            )}

            {replyComposerOpen[review.id] && (
              <div className={styles.replyComposer}>
                <textarea
                  value={replyDrafts[review.id] ?? ''}
                  onChange={(event) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [review.id]: event.target.value
                    }))
                  }
                  placeholder="Напишите ответ на отзыв"
                />
                <button
                  type="button"
                  onClick={() => submitReply(review)}
                  disabled={replySubmitting[review.id] || (replyDrafts[review.id] ?? '').trim().length < 2}
                >
                  {replySubmitting[review.id] ? 'Отправляем…' : 'Отправить ответ'}
                </button>
              </div>
            )}

            {hasReplies && (
              <button type="button" className={styles.toggleReplies} onClick={() => toggleReplies(review)}>
                {expandedReplies[review.id]
                  ? 'Свернуть ответы'
                  : `Показать ${totalRepliesCount} ${totalRepliesCount === 1 ? 'ответ' : totalRepliesCount < 5 ? 'ответа' : 'ответов'}`}
              </button>
            )}

            {loadingReplies[review.id] && <p className={styles.repliesLoading}>Загружаем ответы…</p>}

            {visibleReplies.length > 0 && (
              <div className={styles.replies}>
                {visibleReplies.map((reply) => (
                  <article key={reply.id} className={styles.replyCard}>
                    <header className={styles.replyHeader}>
                      <strong>
                        {reply.authorType === 'SELLER'
                          ? reply.storeName ?? 'Магазин'
                          : reply.buyerNickname ?? 'Покупатель'}
                      </strong>
                      <span className={styles.date}>{formatReviewDate(reply.createdAt)}</span>
                    </header>
                    <p>{reply.text}</p>
                  </article>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
