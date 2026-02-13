import { useState } from 'react';
import { ReturnRequest } from '../../shared/types';
import { ReturnCard } from './ReturnCard';
import { ReturnDetailsModal } from './ReturnDetailsModal';
import styles from './ReturnList.module.css';

interface ReturnListProps {
  items: ReturnRequest[];
  isLoading: boolean;
  error?: string | null;
}

export const ReturnList = ({ items, isLoading, error }: ReturnListProps) => {
  const [activeRequest, setActiveRequest] = useState<ReturnRequest | null>(null);

  if (isLoading) {
    return <p className={styles.empty}>Загрузка возвратов...</p>;
  }
  if (error) {
    return <p className={styles.empty}>{error}</p>;
  }
  if (items.length === 0) {
    return <p className={styles.empty}>У вас пока нет возвратов.</p>;
  }

  return (
    <>
      <div className={styles.list}>
        {items.map((request) => (
          <ReturnCard key={request.id} request={request} onOpen={setActiveRequest} />
        ))}
      </div>
      <ReturnDetailsModal request={activeRequest} onClose={() => setActiveRequest(null)} />
    </>
  );
};
