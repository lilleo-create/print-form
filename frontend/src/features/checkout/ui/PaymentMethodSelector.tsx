import type { CheckoutDto } from '../api/checkoutApi';
import { Button } from '../../../shared/ui/Button';
import styles from './PaymentMethodSelector.module.css';

type Props = {
  data: CheckoutDto;
  onSelectMethod: (method: 'CARD' | 'SBP', cardId?: string) => void;
  onOpenAddCard: () => void;
};

export const PaymentMethodSelector = ({ data, onSelectMethod, onOpenAddCard }: Props) => (
  <div className={styles.block}>
    <h3>Оплата</h3>
    <div className={styles.grid}>
      {data.savedCards.map((card) => (
        <button key={card.id} type="button" className={data.selectedCardId === card.id ? styles.active : styles.item} onClick={() => onSelectMethod('CARD', card.id)}>
          {card.brand} •••• {card.last4}
        </button>
      ))}
      <button type="button" className={data.selectedPaymentMethod === 'SBP' ? styles.active : styles.item} onClick={() => onSelectMethod('SBP')}>
        СБП
      </button>
      <Button variant="secondary" onClick={onOpenAddCard}>Добавить карту</Button>
    </div>
  </div>
);
