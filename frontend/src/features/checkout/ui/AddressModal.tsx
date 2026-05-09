import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../../shared/lib/useBodyScrollLock';
import type { CheckoutDto, CdekPvzSelection } from '../api/checkoutApi';
import styles from './AddressModal.module.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  recipient: CheckoutDto['recipient'];
  pickupPoint?: CdekPvzSelection | null;
  onEditRecipient: () => void;
  onAddPickupPoint: () => void;
};

export const AddressModal = ({
  isOpen,
  onClose,
  recipient,
  pickupPoint,
  onEditRecipient,
  onAddPickupPoint,
}: Props) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const recipientSub = [recipient.email, recipient.phone].filter(Boolean).join('  ');

  const handleRecipient = () => {
    onClose();
    setTimeout(onEditRecipient, 200);
  };

  const handlePickup = () => {
    onClose();
    setTimeout(onAddPickupPoint, 200);
  };

  return createPortal(
    <div
      className={styles.overlay}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* ── Recipient ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Получатель</h3>
          <button type="button" className={styles.row} onClick={handleRecipient}>
            <span className={styles.rowIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <div className={styles.rowBody}>
              <span className={styles.rowMain}>
                {recipient.name || 'Укажите получателя'}
              </span>
              {recipientSub && (
                <span className={styles.rowSub}>{recipientSub}</span>
              )}
            </div>
            <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </section>

        {/* ── Pickup points ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Пункты выдачи</h3>

          {pickupPoint && (
            <div className={styles.row}>
              <span className={`${styles.rowIcon} ${styles.rowIconGreen}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <div className={styles.rowBody}>
                <span className={styles.rowMain}>{pickupPoint.addressFull ?? pickupPoint.pvzId}</span>
                <span className={styles.rowSub}>7 дней хранения · Пункт выдачи</span>
              </div>
              <button type="button" className={styles.editBtn} onClick={handlePickup} aria-label="Изменить">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          )}

          <button type="button" className={styles.addBtn} onClick={handlePickup}>
            {pickupPoint ? 'Изменить пункт выдачи' : 'Добавить пункт выдачи'}
          </button>
        </section>
      </div>
    </div>,
    document.body,
  );
};
