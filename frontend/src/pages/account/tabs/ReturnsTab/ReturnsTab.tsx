import { ReturnCandidatesList, ReturnCandidate as ReturnCandidateItem } from '../../../../components/returns/ReturnCandidatesList';
import { ReturnCreateFlow, ReturnCreateStep } from '../../../../components/returns/ReturnCreateFlow';
import { ReturnList } from '../../../../components/returns/ReturnList';
import { ReturnRequest } from '../../../../shared/types';
import styles from './ReturnsTab.module.css';

interface ReturnsTabProps {
  showReturnCreate: boolean;
  createStep: ReturnCreateStep;
  selectedCandidateId: string | null;
  returnCandidates: ReturnCandidateItem[];
  returns: ReturnRequest[];
  isLoading: boolean;
  error: string | null;
  onStepChange: (step: ReturnCreateStep) => void;
  onOpenFromItem: (item: ReturnCandidateItem) => void;
  onCreated: () => void;
  onReturnToList: () => void;
}

export const ReturnsTab = ({
  showReturnCreate,
  createStep,
  selectedCandidateId,
  returnCandidates,
  returns,
  isLoading,
  error,
  onStepChange,
  onOpenFromItem,
  onCreated,
  onReturnToList
}: ReturnsTabProps) => {
  const returnsByOrderItemId = new Map<string, ReturnRequest>();
  returns.forEach((request) => {
    (request.items ?? []).forEach((item) => {
      if (item.orderItemId) {
        returnsByOrderItemId.set(item.orderItemId, request);
      }
    });
  });

  const approvedOrderItemIds = new Set(
    returns
      .filter((request) => request.status === 'APPROVED' || request.status === 'REFUNDED')
      .flatMap((request) => (request.items ?? []).map((item) => item.orderItemId))
  );

  const filteredCandidates = returnCandidates.filter((item) => {
    if (approvedOrderItemIds.has(item.orderItemId)) return false;
    const existing = returnsByOrderItemId.get(item.orderItemId);
    if (existing && existing.status !== 'REJECTED') return false;
    return true;
  });

  return (
    <div className={styles.section}>
      {showReturnCreate ? (
        <ReturnCreateFlow
          items={filteredCandidates}
          initialSelectedId={selectedCandidateId}
          step={createStep}
          onStepChange={onStepChange}
          onCreated={onCreated}
          onReturnToList={onReturnToList}
        />
      ) : (
        <>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h2>Мои заявки</h2>
            </div>
            <ReturnList items={returns} isLoading={isLoading} error={error} />
          </div>
        </>
      )}
    </div>
  );
};
