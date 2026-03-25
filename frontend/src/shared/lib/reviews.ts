import type { Review, ReviewReply } from '../types';

type UnknownRecord = Record<string, unknown>;

export type ReviewPhotoLike =
  | string
  | {
      url?: string | null;
      fullUrl?: string | null;
      originalUrl?: string | null;
      imageUrl?: string | null;
      src?: string | null;
      thumbUrl?: string | null;
      thumbnailUrl?: string | null;
    };

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' ? (value as UnknownRecord) : null;

const takeString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export const normalizeReviewPhotoUrl = (photo: ReviewPhotoLike): string => {
  if (typeof photo === 'string') return photo;

  return (
    takeString(photo.url) ??
    takeString(photo.fullUrl) ??
    takeString(photo.originalUrl) ??
    takeString(photo.imageUrl) ??
    takeString(photo.src) ??
    takeString(photo.thumbUrl) ??
    takeString(photo.thumbnailUrl) ??
    ''
  );
};

export const getReviewAuthorName = (review: Review): string => {
  const user = asRecord(review.user);
  return (
    takeString(review.buyerNickname) ??
    takeString(user?.nickname) ??
    takeString(user?.name) ??
    takeString(user?.fullName) ??
    'Пользователь'
  );
};

export const getReplyAuthorName = (reply: ReviewReply): string => {
  if (reply.authorType === 'SELLER') {
    return takeString(reply.storeName) ?? 'Пользователь';
  }

  const author = asRecord((reply as ReviewReply & { user?: unknown; author?: unknown }).user)
    ?? asRecord((reply as ReviewReply & { user?: unknown; author?: unknown }).author);

  return (
    takeString(reply.buyerNickname) ??
    takeString(author?.nickname) ??
    takeString(author?.name) ??
    takeString(author?.fullName) ??
    'Пользователь'
  );
};
