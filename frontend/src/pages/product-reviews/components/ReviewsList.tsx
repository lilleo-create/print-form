import type { Review } from '../../../shared/types';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../shared/api';
import { normalizeApiError } from '../../../shared/api/client';
import { Rating } from '../../../shared/ui/Rating';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import { getReplyAuthorName, getReviewAuthorName, normalizeReviewPhotoUrl } from '../../../shared/lib/reviews';
import styles from './ReviewsList.module.css';

type ReviewsListProps = {
  reviews: Review[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  onPhotoClick: (photos: string[], index: number) => void;
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
      const reply = response.data?.data ?? response.data;
      const replyId = typeof reply?.id === 'string' ? reply.id : `${review.id}-${Date.now()}`;
      updateReview(review.id, (item) => ({
        ...item,
        replies: [
          ...(item.replies ?? []).filter((itemReply) => itemReply.id !== replyId),
          {
            ...reply,
            id: replyId,
            reviewId: reply?.reviewId ?? review.id,
            text: reply?.text ?? (reply as { message?: string })?.message ?? text,
            createdAt: reply?.createdAt ?? new Date().toISOString()
          }
        ],
        repliesCount: Math.max((item.repliesCount ?? item.replies?.length ?? 0) + 1, (item.replies?.length ?? 0) + 1)
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
    await api.updateReview(review.id, { comment: nextText });
    updateReview(review.id, (item) => ({ ...item, comment: nextText }));
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
    await api.updateReviewReply(replyId, { text: nextText });
    updateReview(review.id, (item) => ({
      ...item,
      replies: (item.replies ?? []).map((reply) =>
        reply.id === replyId ? { ...reply, text: nextText } : reply
      )
    }));
    setEditingReplyId(null);
  };

  const deleteReply = async (review: Review, replyId: string) => {
    if (!window.confirm('Удалить ответ?')) return;
    await api.deleteReviewReply(replyId);
    updateReview(review.id, (item) => ({
      ...item,
      replies: (item.replies ?? []).filter((reply) => reply.id !== replyId)
    }));
    setOpenedMenuId(null);
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

        return (
          <article key={review.id} className={styles.card}>
            <div className={styles.top}>
              <div>
                <strong>{buyerName}</strong>
                <span className={styles.date}>
                  {formatReviewDate(review.createdAt)}
                </span>
              </div>
              <div className={styles.topActions}>
                <Rating value={review.rating} count={0} />
                {(review.canEdit || review.canDelete) ? (
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
                      <strong>{getReplyAuthorName(reply)}</strong>
                      <div className={styles.replyActions}>
                        <span className={styles.date}>{formatReviewDate(reply.createdAt)}</span>
                        {(reply.canEdit || reply.canDelete) ? (
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
