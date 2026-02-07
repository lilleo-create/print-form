import { ReturnCreateFlow } from '../../../../components/returns/ReturnCreateFlow';
import { ReturnList } from '../../../../components/returns/ReturnList';
import { ReturnRequest } from '../../../../shared/types';
import styles from './ReturnsTab.module.css';

interface ReturnCandidate {
  orderItemId: string;
  productId: string;
  title: string;
  price: number;
  image?: string | null;
  orderDate: string;
  orderId: string;
}

interface ReturnsTabProps {
  showReturnCreate: boolean;
  returnCandidates: ReturnCandidate[];
  returns: ReturnRequest[];
  isLoading: boolean;
  error: string | null;
  onCreated: () => void;
  onReturnToList: () => void;
}

export const ReturnsTab = ({
  showReturnCreate,
  returnCandidates,
  returns,
  isLoading,
  error,
  onCreated,
  onReturnToList
}: ReturnsTabProps) => {
  return (
    <div className={styles.section}>
      {showReturnCreate ? (
        <ReturnCreateFlow items={returnCandidates} onCreated={onCreated} onReturnToList={onReturnToList} />
      ) : (
        <ReturnList items={returns} isLoading={isLoading} error={error} />
      )}
    </div>
  );
};
