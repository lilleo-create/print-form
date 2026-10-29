import type { OrderFinancials } from '../../shared/types';
import { formatPrice } from '../../shared/lib/formatPrice';
import styles from './OrderFinancialsSummary.module.css';

type Props = {
  financials: OrderFinancials;
  deliveryEtaText?: string | null;
  isPaid?: boolean;
};

export const OrderFinancialsSummary = ({ financials, deliveryEtaText, isPaid = false }: Props) => {
  const { itemsSubtotal, total, platformFeeAmount, sellerNetAmount } = financials;
  const feeAmount = platformFeeAmount + (financials.acquiringFeeAmount ?? 0);
  const hasActual = financials.confirmedActualDeliveryAmount != null;
  const hasPacked = financials.packedDeliveryAmount != null;
  const deliveryCost = financials.confirmedActualDeliveryAmount ?? financials.packedDeliveryAmount ??
    financials.checkoutDeliveryEstimateAmount ?? financials.effectiveDeliveryCost ?? 0;
  const deliveryLabel = hasActual ? 'Фактическая доставка' : hasPacked ? 'Расчётная доставка' : 'Ориентировочная доставка';
  const netLabel = hasActual ? 'Итого продавцу' : hasPacked ? 'После доставки' : 'Ориентир. после доставки';
  const net = financials.sellerNetAfterDeliveryAmount ?? sellerNetAmount - deliveryCost;

  return (
    <div>
      <div className={styles.summary}>
        <div className={styles.row}>
          <span className={styles.label}>Товары</span>
          <span className={styles.value}>{formatPrice(itemsSubtotal)}</span>
        </div>

        <div className={styles.totalRow}>
          <span>{isPaid ? 'Итого оплачено' : 'Сумма заказа'}</span>
          <span className={styles.totalValue}>{formatPrice(total)}</span>
        </div>
        <div className={styles.feeRow}>
          <span className={styles.feeLabel}>Комиссия и эквайринг</span>
          <span className={styles.feeValue}>{formatPrice(feeAmount)}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{deliveryLabel}{deliveryEtaText ? ` · ${deliveryEtaText}` : ''}</span>
          <span className={styles.value}>{formatPrice(deliveryCost)}</span>
        </div>
        {!hasPacked && !hasActual && <p className={styles.hint}>
          Предварительный расчёт по данным товара. После упаковки стоимость будет пересчитана.
        </p>}

        <div className={styles.divider} />

        <div className={styles.payoutRow}>
          <span>{netLabel}</span>
          <span className={styles.payoutValue}>{net < 0 ? '—' : formatPrice(net)}</span>
        </div>
        {net < 0 && <p className={styles.error}>Стоимость доставки превышает сумму к выплате</p>}
      </div>
    </div>
  );
};
