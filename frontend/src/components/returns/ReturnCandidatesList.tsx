import { ReturnRequest } from '../../shared/types';
import { ReturnCandidate } from './ReturnCreateFlow';
import { ReturnCandidateCard } from './ReturnCandidateCard';
import { ReturnCreatePanel } from './ReturnCreatePanel';
import styles from './ReturnCandidatesList.module.css';

interface ReturnCandidatesListProps {
  items: ReturnCandidate[];
  returnsByOrderItemId: Map<string, ReturnRequest>;
  selectedOrderItemId: string | null;
  onSelect: (orderItemId: string | null) => void;
  onCreated: () => void;
  onAlreadyExists: (orderItemId: string) => void;
  onChat: () => void;
}

export const ReturnCandidatesList = ({
  items,
  returnsByOrderItemId,
  selectedOrderItemId,
  onSelect,
  onCreated,
  onAlreadyExists,
  onChat
}: ReturnCandidatesListProps) => {
  if (items.length === 0) {
    return <p className={styles.empty}>Нет доставленных заказов для возврата.</p>;
  }

  return (
    <div className={styles.list}>
      {items.map((item) => {
        const existingReturn = returnsByOrderItemId.get(item.orderItemId);
        const isSelected = selectedOrderItemId === item.orderItemId;
        return (
          <div key={item.orderItemId} className={styles.item}>
            <ReturnCandidateCard
              title={item.title}
              price={item.price}
              image={item.image}
              orderDate={item.orderDate}
              isReturning={Boolean(existingReturn)}
              onCreate={() => onSelect(item.orderItemId)}
              onChat={onChat}
            />
            {isSelected && !existingReturn && (
              <div className={styles.formPanel}>
                <ReturnCreatePanel
                  item={item}
                  onCreated={() => {
                    onCreated();
                    onSelect(null);
                  }}
                  onAlreadyExists={() => {
                    onAlreadyExists(item.orderItemId);
                    onSelect(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
