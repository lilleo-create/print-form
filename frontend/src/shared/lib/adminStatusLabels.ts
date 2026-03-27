import type { ChatThreadStatus, KycStatus, ReturnStatus, ReviewModerationStatus } from '../types';

const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  PENDING: 'На проверке',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
  REVISION: 'Нужны исправления'
};

const REVIEW_STATUS_LABELS: Record<ReviewModerationStatus, string> = {
  PENDING: 'На модерации',
  APPROVED: 'Опубликован',
  REJECTED: 'Отклонён',
  NEEDS_EDIT: 'Нужны исправления'
};

const CHAT_THREAD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Открыт',
  CLOSED: 'Закрыт',
  PENDING: 'Ожидает',
  ARCHIVED: 'В архиве'
};

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  CREATED: 'Создан',
  UNDER_REVIEW: 'На рассмотрении',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
  REFUNDED: 'Возврат выполнен'
};

const pickBackendLabel = (...labels: Array<string | null | undefined>) => {
  const normalized = labels.find((label) => typeof label === 'string' && label.trim().length > 0);
  return normalized?.trim();
};

export const getKycStatusLabel = (status: KycStatus, statusLabelRu?: string | null) =>
  pickBackendLabel(statusLabelRu) ?? KYC_STATUS_LABELS[status] ?? status;

export const getReviewStatusLabel = (
  status?: ReviewModerationStatus | null,
  moderationStatusLabelRu?: string | null
) => {
  if (!status) return pickBackendLabel(moderationStatusLabelRu) ?? '—';
  return pickBackendLabel(moderationStatusLabelRu) ?? REVIEW_STATUS_LABELS[status] ?? status;
};

export const getChatThreadStatusLabel = (
  status: ChatThreadStatus | string,
  statusLabelRu?: string | null
) => pickBackendLabel(statusLabelRu) ?? CHAT_THREAD_STATUS_LABELS[String(status).toUpperCase()] ?? status;

export const getReturnStatusLabel = (status: ReturnStatus, statusLabelRu?: string | null) =>
  pickBackendLabel(statusLabelRu) ?? RETURN_STATUS_LABELS[status] ?? status;

export const getKycStatusOptions = (statuses: readonly KycStatus[]) =>
  statuses.map((status) => ({ value: status, label: getKycStatusLabel(status) }));

export const getReviewStatusOptions = (statuses: readonly ReviewModerationStatus[]) =>
  statuses.map((status) => ({ value: status, label: getReviewStatusLabel(status) }));
