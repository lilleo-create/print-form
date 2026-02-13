import { ReturnRequest } from '../../shared/types';

export const statusLabels: Record<ReturnRequest['status'], string> = {
  CREATED: 'Создана',
  UNDER_REVIEW: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
  REFUNDED: 'Возврат выполнен'
};

export const reasonLabels: Record<ReturnRequest['reason'], string> = {
  NOT_FIT: 'Не подошло',
  DAMAGED: 'Брак или повреждение',
  WRONG_ITEM: 'Привезли не то'
};
