import type { OrderFinancials } from '../../shared/types';
import { formatPrice } from '../../shared/lib/formatPrice';
import styles from './OrderFinancialsSummary.module.css';

type Props = {
  financials: OrderFinancials;
  deliveryEtaText?: string | null;
};

export const OrderFinancialsSummary = ({ financials, deliveryEtaText }: Props) => {
  const { itemsSubtotal, deliveryAmount, total, platformFeePercent, platformFeeAmount, sellerNetAmount } = financials;

  const payoutIsLow = sellerNetAmount > 0 && total > 0 && sellerNetAmount < total * 0.5;
  const payoutColorClass = payoutIsLow ? styles.payoutOrange : styles.payoutGreen;

  return (
    <div>
      <div className={styles.summary}>
        <div className={styles.row}>
          <span className={styles.label}>Товары</span>
          <span className={styles.value}>{formatPrice(itemsSubtotal)}</span>
        </div>

        {deliveryAmount > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>
              Доставка СДЭК
              {deliveryEtaText ? ` · ${deliveryEtaText}` : ''}
            </span>
            <span className={styles.value}>+{formatPrice(deliveryAmount)}</span>
          </div>
        )}

        <div className={styles.divider} />

        <div className={styles.totalRow}>
          <span>Итого оплачено</span>
          <span className={styles.totalValue}>{formatPrice(total)}</span>
        </div>

        {platformFeeAmount > 0 && (
          <div className={styles.feeRow}>
            <span className={styles.feeLabel}>
              Комиссия{platformFeePercent !== null ? ` (${platformFeePercent}%)` : ''}
            </span>
            <span className={styles.feeValue}>−{formatPrice(platformFeeAmount)}</span>
          </div>
        )}

        <div className={styles.divider} />

        <div className={styles.payoutRow}>
          <span>Вы получите</span>
          <span className={`${styles.payoutValue} ${payoutColorClass}`}>
            {formatPrice(sellerNetAmount)}
          </span>
        </div>
      </div>
    </div>
  );
};
