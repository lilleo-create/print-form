import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReturnRequest } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { ProductMiniCard } from '../ProductMiniCard';
import styles from './ReturnCandidatesList.module.css';

export interface ReturnCandidate {
  orderItemId: string;
  productId: string;
  title: string;
  price: number;
  image?: string;
  orderDate: string;
  orderId: string;
  actionType?: 'RETURN' | 'CANCEL';
}

interface ReturnCandidatesListProps {
  items?: ReturnCandidate[];
  returnsByOrderItemId: Map<string, ReturnRequest>;
  onCreate: (item: ReturnCandidate) => void;
  highlightedOrderId?: string | null;
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
  onCreate,
  highlightedOrderId = null
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
        return (
          <article
            key={item.orderItemId}
            className={`${styles.card} ${highlightedOrderId === item.orderId ? styles.cardHighlighted : ''}`.trim()}
          >
            <div className={styles.row}>
              <div className={styles.meta}>
                <span className={styles.caption}>
                  Заказ от{' '}
                  {new Date(item.orderDate).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
                <ProductMiniCard title={item.title} price={item.price} image={item.image} />
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
                  {item.actionType === 'CANCEL' ? 'Отменить заказ' : 'Оформить возврат'}
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
