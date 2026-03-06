import { useMemo, useState } from 'react';
import { ReturnCandidatesList, ReturnCandidate as ReturnCandidateItem } from '../../../../components/returns/ReturnCandidatesList';
import { ReturnCreateFlow, ReturnCreateStep } from '../../../../components/returns/ReturnCreateFlow';
import { ReturnList } from '../../../../components/returns/ReturnList';
import { ordersApi } from '../../../../shared/api/ordersApi';
import { ReturnRequest } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import { Modal } from '../../../../shared/ui/Modal';
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
  const [cancelCandidate, setCancelCandidate] = useState<ReturnCandidateItem | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

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

  const returnFlowItems = useMemo(
    () => filteredCandidates.filter((item) => item.actionType !== 'CANCEL'),
    [filteredCandidates]
  );

  const cancelItems = useMemo(
    () => filteredCandidates.filter((item) => item.actionType === 'CANCEL'),
    [filteredCandidates]
  );

  const handleCandidateAction = (item: ReturnCandidateItem) => {
    if (item.actionType === 'CANCEL') {
      setCancelCandidate(item);
      setCancelError(null);
      return;
    }
    onOpenFromItem(item);
  };

  const handleCancelOrder = async () => {
    if (!cancelCandidate) return;
    setCancelError(null);
    setIsCancelling(true);

    try {
      await ordersApi.cancelMyOrder(cancelCandidate.orderId);
      setCancelCandidate(null);
      onCreated();
    } catch {
      setCancelError('Не удалось отменить заказ. Попробуйте ещё раз.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className={styles.section}>
      {showReturnCreate ? (
        <ReturnCreateFlow
          items={returnFlowItems}
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
              <h2>Доступные действия по покупкам</h2>
            </div>
            <ReturnCandidatesList
              items={filteredCandidates}
              returnsByOrderItemId={returnsByOrderItemId}
              onCreate={handleCandidateAction}
            />
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h2>Мои заявки</h2>
            </div>
            <ReturnList items={returns} isLoading={isLoading} error={error} />
          </div>
        </>
      )}

      <Modal isOpen={Boolean(cancelCandidate)} onClose={() => setCancelCandidate(null)} className={styles.cancelModal}>
        <h3>Отменить заказ?</h3>
        <p className={styles.cancelModalText}>
          {cancelCandidate
            ? `Заказ с товаром «${cancelCandidate.title}» ещё не отправлен в доставку. Его можно отменить без оформления возврата.`
            : ''}
        </p>
        {cancelError && <p className={styles.cancelModalError}>{cancelError}</p>}
        <div className={styles.cancelModalActions}>
          <Button type="button" variant="secondary" onClick={() => setCancelCandidate(null)}>
            Оставить заказ
          </Button>
          <Button type="button" onClick={handleCancelOrder} disabled={isCancelling}>
            {isCancelling ? 'Отменяем…' : 'Подтвердить отмену'}
          </Button>
        </div>
      </Modal>

      {cancelItems.length > 0 && !showReturnCreate && (
        <p className={styles.cancelHint}>
          Для неотправленных заказов доступна отмена, для отправленных — оформление возврата.
        </p>
      )}
    </div>
  );
};
