import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { ReturnRequest } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import styles from './ReturnCandidatesList.module.css';

export interface ReturnCandidate {
  orderItemId: string;
  productId: string;
  title: string;
  price: number;
  image?: string;
  orderDate: string;
  orderId: string;
}

interface ReturnCandidatesListProps {
  items?: ReturnCandidate[];
  returnsByOrderItemId: Map<string, ReturnRequest>;
  onCreate: (item: ReturnCandidate) => void;
}

const statusLabels: Record<ReturnRequest['status'], string> = {
  CREATED: 'Заявка отправлена',
  UNDER_REVIEW: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
  REFUNDED: 'Возврат выполнен'
};

export const ReturnCandidatesList = ({
  items,
  returnsByOrderItemId,
  onCreate
}: ReturnCandidatesListProps) => {
  const navigate = useNavigate();
  const safeItems = useMemo(() => items ?? [], [items]);

  if (safeItems.length === 0) {
    return <p className={styles.empty}>Пока нет товаров для возврата.</p>;
  }

  return (
    <div className={styles.grid}>
      {safeItems.map((item) => {
        const returnRequest = returnsByOrderItemId.get(item.orderItemId);
        const threadId = returnRequest?.chatThread?.id ?? null;
        const imageSrc = resolveImageUrl(item.image);
        return (
          <article key={item.orderItemId} className={styles.card}>
            <div className={styles.row}>
              {imageSrc ? (
                <img src={imageSrc} alt={item.title} />
              ) : (
                <div className={styles.imagePlaceholder} aria-hidden="true" />
              )}
              <div className={styles.meta}>
                <span className={styles.caption}>
                  Заказ от{' '}
                  {new Date(item.orderDate).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
                <strong>{item.title}</strong>
                <span>{item.price.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
            <div className={styles.actions}>
              {returnRequest && <span className={styles.badge}>{statusLabels[returnRequest.status]}</span>}
              {returnRequest && returnRequest.status !== 'REJECTED' ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    navigate(`/account?tab=chats${threadId ? `&threadId=${threadId}` : ''}`)
                  }
                >
                  Перейти в чат
                </Button>
              ) : (
                <Button type="button" onClick={() => onCreate(item)}>
                  Создать
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
