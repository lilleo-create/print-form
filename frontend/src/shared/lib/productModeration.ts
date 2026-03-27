import { ProductModerationStatus } from '../types';

const DEFAULT_LABEL = 'Статус неизвестен';

export const MODERATION_STATUS_LABELS_RU: Record<ProductModerationStatus, string> = {
  DRAFT: 'Черновик',
  PENDING: 'На проверке',
  NEEDS_EDIT: 'Нужна доработка',
  REJECTED: 'Отклонён',
  APPROVED: 'Одобрен',
  ARCHIVED: 'В архиве'
};

export const getModerationStatusLabelRu = (
  status?: ProductModerationStatus | null,
  labelFromBackend?: string | null
) => {
  if (typeof labelFromBackend === 'string' && labelFromBackend.trim()) {
    return labelFromBackend.trim();
  }
  if (!status) return DEFAULT_LABEL;
  return MODERATION_STATUS_LABELS_RU[status] ?? DEFAULT_LABEL;
};

export const getModerationStatusTone = (status?: ProductModerationStatus | null) => {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'NEEDS_EDIT':
      return 'needsEdit';
    case 'REJECTED':
      return 'rejected';
    case 'APPROVED':
      return 'approved';
    case 'ARCHIVED':
      return 'archived';
    default:
      return 'default';
  }
};
