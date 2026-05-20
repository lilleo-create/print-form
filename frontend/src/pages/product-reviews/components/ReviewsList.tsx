import type { Review, ReviewReply } from '../../../shared/types';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../shared/api';
import { normalizeApiError } from '../../../shared/api/client';
import { Rating } from '../../../shared/ui/Rating';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import { getReplyAuthorName, getReviewAuthorName, normalizeReviewPhotoUrl } from '../../../shared/lib/reviews';
import styles from './ReviewsList.module.css';

type ReviewsListProps = {
  reviews: Review[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  onRetry?: () => void;
  onPhotoClick: (photos: string[], index: number) => void;
};

const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

const getReplyActionErrorMessage = (error: unknown, fallback: string) => {
  const normalized = normalizeApiError(error);
  const status = normalized.status;
  if (status === 401) {
    return 'Чтобы изменить ответ, нужно войти в аккаунт.';
  }
  if (status === 403) {
    return 'У вас нет доступа к изменению этого ответа.';
  }
  if (status === 404) {
    return 'Ответ не найден. Обновите страницу и попробуйте снова.';
  }
  if (status === 422 || normalized.code === 'VALIDATION_ERROR') {
    return 'Не удалось сохранить ответ: проверьте текст и попробуйте снова.';
  }
  if (normalized.message && normalized.message !== normalized.code) {
    return normalized.message;
  }
  return fallback;
};

const unwrapPayload = <T,>(payload: unknown): T | null => {
  if (payload == null) return null;
  if (typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: T }).data ?? null;
  }
  return payload as T;
};

const normalizeReply = (
  reply: Partial<ReviewReply> & { message?: string } | null | undefined,
  reviewId: string,
  fallbackText: string
): ReviewReply => ({
  ...reply,
  id: typeof reply?.id === 'string' ? reply.id : `${reviewId}-${Date.now()}`,
  reviewId: reply?.reviewId ?? reviewId,
  text: reply?.text ?? (reply as { message?: string })?.message ?? fallbackText,
  createdAt: reply?.createdAt ?? new Date().toISOString(),
  authorType: reply?.authorType ?? 'SELLER'
});

const normalizeReview = (review: Review): Review => ({
  ...review,
  replies: (review.replies ?? []).map((reply) => normalizeReply(reply, review.id, reply.text ?? ''))
});

export const ReviewsList = ({
  reviews,
  status,
  error,
  onRetry,
  onPhotoClick
}: ReviewsListProps) => {
  const [localReviews, setLocalReviews] = useState<Record<string, Review>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [replyComposerOpen, setReplyComposerOpen] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<string, boolean>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({});
  const [reactionSubmitting, setReactionSubmitting] = useState<Record<string, boolean>>({});
  const [reactionErrors, setReactionErrors] = useState<Record<string, string>>({});
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  useEffect(() => {
    if (!openedMenuId) return;
    const handler = () => setOpenedMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openedMenuId]);

  useEffect(() => {
    const visibleIds = new Set(reviews.map((review) => review.id));
    setLocalReviews((prev) => {
      const nextEntries = Object.entries(prev).filter(([reviewId]) => visibleIds.has(reviewId));
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [reviews]);

  const mergedReviews = useMemo(
    () => reviews.map((review) => localReviews[review.id] ?? normalizeReview(review)),
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

  const handleReaction = async (reviewId: string, reaction: 'LIKE' | 'DISLIKE') => {
    const review = mergedReviews.find((item) => item.id === reviewId);
    if (!review) return;
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
      const payload = (response.data?.data ?? response.data) as {
        currentUserReaction?: 'LIKE' | 'DISLIKE' | null;
        reactions?: { likes: number; dislikes: number };
        likesCount?: number;
        dislikesCount?: number;
      };
      const nextLikes = payload.reactions?.likes ?? payload.likesCount;
      const nextDislikes = payload.reactions?.dislikes ?? payload.dislikesCount;
      updateReview(review.id, (item) => ({
        ...item,
        currentUserReaction: payload.currentUserReaction ?? nextReaction,
        reactions:
          typeof nextLikes === 'number' && typeof nextDislikes === 'number'
            ? { likes: nextLikes, dislikes: nextDislikes }
            : payload.reactions ?? item.reactions
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
              : status === 422 || normalized.code === 'VALIDATION_ERROR'
                ? 'Не удалось применить реакцию: сервер отклонил данные.'
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

  const submitReply = async (reviewId: string) => {
    const review = mergedReviews.find((item) => item.id === reviewId);
    if (!review) return;
    const text = (replyDrafts[review.id] ?? '').trim();
    if (!text || !review.productId) return;

    setReplyErrors((prev) => {
      if (!prev[review.id]) return prev;
      const next = { ...prev };
      delete next[review.id];
      return next;
    });

    setReplySubmitting((prev) => ({ ...prev, [review.id]: true }));
    try {
      const response = await api.createReviewReply(review.productId, review.id, text);
      const reply = normalizeReply(
        unwrapPayload<Partial<ReviewReply> & { message?: string }>(unwrapPayload<unknown>(response)),
        review.id,
        text
      );
      updateReview(review.id, (item) => ({
        ...item,
        replies: [
          ...(item.replies ?? []).filter((itemReply) => itemReply.id !== reply.id),
          reply
        ],
        repliesCount: Math.max(item.repliesCount ?? 0, (item.replies?.length ?? 0) + 1)
      }));
      setReplyDrafts((prev) => ({ ...prev, [review.id]: '' }));
      setExpandedReplies((prev) => ({ ...prev, [review.id]: true }));
    } catch (error) {
      const normalized = normalizeApiError(error);
      const status = normalized.status;
      const readableError =
        status === 401
          ? 'Чтобы отвечать на отзывы, нужно войти в аккаунт.'
          : status === 404
              ? 'Отзыв не найден. Обновите страницу и попробуйте снова.'
              : status === 422 || normalized.code === 'VALIDATION_ERROR'
                ? 'Ответ не прошёл проверку. Измените текст и попробуйте ещё раз.'
              : normalized.message && normalized.message !== normalized.code
                ? normalized.message
                : 'Не удалось отправить ответ. Попробуйте позже.';
      setReplyErrors((prev) => ({ ...prev, [review.id]: readableError }));
    } finally {
      setReplySubmitting((prev) => ({ ...prev, [review.id]: false }));
    }
  };

  const startEditReview = (review: Review) => {
    setEditingReviewId(review.id);
    setEditingReplyId(null);
    setEditDraft(review.comment ?? '');
    setOpenedMenuId(null);
  };

  const saveReviewEdit = async (review: Review) => {
    const nextText = editDraft.trim();
    if (!nextText || nextText === review.comment) {
      setEditingReviewId(null);
      return;
    }
    const response = await api.updateReview(review.id, { comment: nextText });
    const payload = unwrapPayload<Review>(unwrapPayload<unknown>(response));
    const updatedReview = payload && typeof payload === 'object' && 'id' in payload
      ? normalizeReview(payload as Review)
      : null;
    updateReview(review.id, (item) => ({ ...item, ...(updatedReview ?? {}), comment: nextText, id: item.id }));
    setEditingReviewId(null);
  };

  const deleteReview = async (review: Review) => {
    if (!window.confirm('Удалить отзыв?')) return;
    await api.deleteReview(review.id);
    setLocalReviews((prev) => ({ ...prev, [review.id]: { ...review, canDelete: false, comment: 'Отзыв удалён' } }));
    setOpenedMenuId(null);
  };

  const startEditReply = (replyId: string, text: string) => {
    setEditingReviewId(null);
    setEditingReplyId(replyId);
    setEditDraft(text);
    setOpenedMenuId(null);
  };

  const saveReplyEdit = async (review: Review, replyId: string) => {
    const nextText = editDraft.trim();
    if (!nextText) return;

    setReplyErrors((prev) => {
      if (!prev[review.id]) return prev;
      const next = { ...prev };
      delete next[review.id];
      return next;
    });

    try {
      const response = await api.updateReviewReply(replyId, { text: nextText });
      const updatedReply = normalizeReply(
        unwrapPayload<Partial<ReviewReply> & { message?: string }>(unwrapPayload<unknown>(response)),
        review.id,
        nextText
      );
      updateReview(review.id, (item) => ({
        ...item,
        replies: (item.replies ?? []).map((reply) =>
          reply.id === replyId ? { ...reply, ...updatedReply, id: reply.id } : reply
        )
      }));
      setEditingReplyId(null);
    } catch (error) {
      setReplyErrors((prev) => ({
        ...prev,
        [review.id]: getReplyActionErrorMessage(
          error,
          'Не удалось сохранить ответ. Попробуйте позже.'
        )
      }));
    }
  };

  const deleteReply = async (review: Review, replyId: string) => {
    if (!window.confirm('Удалить ответ?')) return;

    setReplyErrors((prev) => {
      if (!prev[review.id]) return prev;
      const next = { ...prev };
      delete next[review.id];
      return next;
    });

    try {
      await api.deleteReviewReply(replyId);
      updateReview(review.id, (item) => ({
        ...item,
        replies: (item.replies ?? []).filter((reply) => reply.id !== replyId)
      }));
      setOpenedMenuId(null);
    } catch (error) {
      setReplyErrors((prev) => ({
        ...prev,
        [review.id]: getReplyActionErrorMessage(
          error,
          'Не удалось удалить ответ. Попробуйте позже.'
        )
      }));
    }
  };

  if (error) {
    return (
      <div className={styles.empty}>
        <p>{error}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry}>
            Повторить
          </button>
        ) : null}
      </div>
    );
  }

  if (status === 'loading' && reviews.length === 0) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className={styles.card}>
            <div className={styles.skeletonTop}>
              <div>
                <Skeleton className={styles.skeletonName} />
                <Skeleton className={styles.skeletonDate} />
              </div>
              <Skeleton className={styles.skeletonRating} />
            </div>
            <Skeleton className={styles.skeletonLine} />
            <Skeleton className={styles.skeletonLine} />
            <Skeleton className={styles.skeletonLineShort} />
            <div className={styles.skeletonPhotos}>
              <Skeleton className={styles.skeletonPhoto} />
              <Skeleton className={styles.skeletonPhoto} />
              <Skeleton className={styles.skeletonPhoto} />
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return <p className={styles.empty}>Пока нет отзывов.</p>;
  }

  return (
    <div className={styles.list}>
      {mergedReviews.map((review) => {
        const reviewPhotos = (review.photos ?? [])
          .map((photo) => normalizeReviewPhotoUrl(photo))
          .filter(Boolean);
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
        const buyerName = getReviewAuthorName(review);
        const moderationBadge = review.isOwn && review.moderationStatus === 'PENDING'
          ? (review.moderationStatusLabelRu?.trim() || 'На модерации')
          : null;

        const initials = buyerName
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0])
          .join('');

        return (
          <article key={review.id} className={styles.card}>
            <div className={styles.top}>
              <div className={styles.authorRow}>
                <div className={styles.avatar}>{initials || '?'}</div>
                <div className={styles.authorInfo}>
                  <strong>{buyerName}</strong>
                  <span className={styles.date}>
                    {formatReviewDate(review.createdAt)}
                  </span>
                  {moderationBadge ? <span className={styles.pendingBadge}>{moderationBadge}</span> : null}
                </div>
              </div>
              <div className={styles.topActions}>
                <Rating value={review.rating} count={0} />
                {review.isOwn !== false && (review.canEdit || review.canDelete) ? (
                  <div className={styles.menuWrap}>
                    <button type="button" className={styles.menuButton} onClick={(event) => {
                      event.stopPropagation();
                      setOpenedMenuId((prev) => (prev === review.id ? null : review.id));
                    }}>
                      ⋮
                    </button>
                    {openedMenuId === review.id ? (
                      <div className={styles.menu} onClick={(event) => event.stopPropagation()}>
                        {review.canEdit ? <button type="button" onClick={() => startEditReview(review)}>Редактировать</button> : null}
                        {review.canDelete ? <button type="button" onClick={() => deleteReview(review).catch(() => undefined)}>Удалить</button> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={styles.body}>
              <p>
                <strong>Достоинства:</strong> {review.pros}
              </p>
              <p>
                <strong>Недостатки:</strong> {review.cons}
              </p>
              <p>
                <strong>Комментарий:</strong>{' '}
                {editingReviewId === review.id ? (
                  <span className={styles.inlineEdit}>
                    <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} />
                    <button type="button" onClick={() => saveReviewEdit(review).catch(() => undefined)}>Сохранить</button>
                  </span>
                ) : review.comment}
              </p>
            </div>

            {reviewPhotos.length > 0 && (
              <div className={styles.photos}>
                {reviewPhotos.map((photo, index) => (
                  <button
                    key={`${photo}-${index}`}
                    type="button"
                    className={styles.photoButton}
                    onClick={() => onPhotoClick(reviewPhotos, index)}
                  >
                    <img
                      src={resolveImageUrl(photo)}
                      alt="Фото отзыва"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.replyTrigger}
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
                  onClick={() => handleReaction(review.id, 'LIKE')}
                  disabled={reactionSubmitting[review.id]}
                >
                  👍 {likes}
                </button>
                <button
                  type="button"
                  className={review.currentUserReaction === 'DISLIKE' ? styles.reactionActive : ''}
                  onClick={() => handleReaction(review.id, 'DISLIKE')}
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
                  onClick={() => submitReply(review.id)}
                  disabled={replySubmitting[review.id] || (replyDrafts[review.id] ?? '').trim().length < 2}
                >
                  {replySubmitting[review.id] ? 'Отправляем…' : 'Отправить ответ'}
                </button>
              </div>
            )}

            {replyErrors[review.id] && <p className={styles.replyError}>{replyErrors[review.id]}</p>}

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
                      <div>
                        <strong>{getReplyAuthorName(reply)}</strong>
                        {reply.isOwn && reply.moderationStatus === 'PENDING' ? (
                          <span className={styles.pendingBadge}>
                            {reply.moderationStatusLabelRu?.trim() || 'На модерации'}
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.replyActions}>
                        <span className={styles.date}>{formatReviewDate(reply.createdAt)}</span>
                        {reply.isOwn !== false && (reply.canEdit || reply.canDelete) ? (
                          <div className={styles.menuWrap}>
                            <button type="button" className={styles.menuButton} onClick={(event) => {
                              event.stopPropagation();
                              setOpenedMenuId((prev) => (prev === reply.id ? null : reply.id));
                            }}>
                              ⋮
                            </button>
                            {openedMenuId === reply.id ? (
                              <div className={styles.menu} onClick={(event) => event.stopPropagation()}>
                                {reply.canEdit ? <button type="button" onClick={() => startEditReply(reply.id, reply.text)}>Редактировать</button> : null}
                                {reply.canDelete ? <button type="button" onClick={() => deleteReply(review, reply.id).catch(() => undefined)}>Удалить</button> : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </header>
                    <p>
                      {editingReplyId === reply.id ? (
                        <span className={styles.inlineEdit}>
                          <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} />
                          <button type="button" onClick={() => saveReplyEdit(review, reply.id).catch(() => undefined)}>Сохранить</button>
                        </span>
                      ) : reply.text}
                    </p>
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
