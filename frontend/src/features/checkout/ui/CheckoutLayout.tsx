import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { useCheckoutStore } from '../model/useCheckoutStore';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';
import { AddressBlock } from './AddressBlock';
import { PickupPointBlock } from './PickupPointBlock';
import { CdekPvzPickerModal } from '../../../components/checkout/CdekPvzPickerModal';
import { RecipientModal } from './RecipientModal';
import { DeliveryDatesSection } from './DeliveryDatesSection';
import { CheckoutItemsList } from './CheckoutItemsList';
import { CheckoutLegalLinks } from './CheckoutLegalLinks';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { AddCardModal } from './AddCardModal';
import styles from './CheckoutLayout.module.css';
import { formatPrice } from '../../../shared/lib/formatPrice';
import { useBuyNowStore } from '../../../app/store/buyNowStore';

export const CheckoutLayout = () => {
  const isBuyNowFlow = useBuyNowStore((state) => state.isActive);
  const {
    data,
    error,
    isLoading,
    isSubmittingOrder,
    fetchCheckout,
    setDeliveryMethod,
    setPickupPoint,
    updateRecipient,
    updateAddress,
    setPaymentMethod,
    addCard,
    placeOrder
  } = useCheckoutStore();

  const [isPvzOpen, setPvzOpen] = useState(false);
  const [isRecipientOpen, setRecipientOpen] = useState(false);
  const [isAddCardOpen, setAddCardOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    void fetchCheckout();
  }, [fetchCheckout]);

  const total = useMemo(
    () =>
      data?.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0) ??
      0,
    [data?.cartItems]
  );

  const selectedDeliveryMethod = data?.selectedDeliveryMethod ?? 'COURIER';
  const selectedPaymentMethod = data?.selectedPaymentMethod ?? 'CARD';
  const availableDeliveryMethods = data?.deliveryMethods ?? [];

  const handlePayClick = async () => {
    if (isPaying) return;
    setIsPaying(true);
    try {
      const result = await placeOrder();
      if (!result) return;
      window.location.href = result.paymentUrl;
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading && !data) return <p className={styles.state}>Загрузка checkout…</p>;

  if (!data) {
    return <p className={styles.state}>{error ?? 'Не удалось загрузить checkout'}</p>;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        <section className={styles.sectionCard}>
          <h2>{isBuyNowFlow ? 'Доставка · Купить сейчас' : 'Доставка'}</h2>

          <DeliveryMethodSelector
            methods={availableDeliveryMethods}
            selected={selectedDeliveryMethod}
            onSelect={(code) => void setDeliveryMethod(code)}
          />

          {selectedDeliveryMethod === 'PICKUP_POINT' ? (
            <PickupPointBlock
              point={data.selectedPickupPoint ?? null}
              onOpen={() => {
                setPvzOpen(true);
              }}
            />
          ) : (
            <AddressBlock
              address={data.address}
              onEdit={() => {
                void updateAddress(
                  data.address ?? {
                    line1: '',
                    city: 'Москва',
                    postalCode: '125040',
                    country: 'Россия'
                  }
                );
              }}
            />
          )}

          <button
            type="button"
            className={styles.recipientTrigger}
            onClick={() => setRecipientOpen(true)}
          >
            <strong>Получатель</strong>
            <span>{data.recipient.name || 'Указать ФИО и контакты'}</span>
          </button>

          <DeliveryDatesSection items={data.cartItems} />
        </section>

        <section className={styles.sectionCard}>
          <CheckoutItemsList items={data.cartItems} />
        </section>

        <CheckoutLegalLinks accepted={legalAccepted} onAcceptedChange={setLegalAccepted} />
      </div>

      <aside className={styles.right}>
        <div className={styles.summaryCard}>
          <h3 className={styles.summaryTitle}>Ваш заказ</h3>
          <div className={styles.summary}>
            <p className={styles.summaryRow}><span>{data.cartItems.length} товар(а)</span><strong>{formatPrice(total)}</strong></p>
            <p className={styles.summaryRow}><span>Скидка</span><strong>−0 ₽</strong></p>
            <p className={styles.summaryRow}><span>Доставка и сервисы</span><strong>149 ₽</strong></p>
            <p className={styles.summaryTotal}><span>Итого</span><strong>{formatPrice(total + 149)}</strong></p>
          </div>

          <PaymentMethodSelector
            data={data}
            onSelectMethod={(method, cardId) => void setPaymentMethod(method, cardId)}
            onOpenAddCard={() => setAddCardOpen(true)}
          />

          <Button
            className={styles.payButton}
            isLoading={isSubmittingOrder || isPaying}
            disabled={isPaying || !legalAccepted}
            onClick={() => void handlePayClick()}
          >
            Оплатить
          </Button>

          {!legalAccepted ? (
            <p className={styles.error}>
              Подтвердите согласие с правилами сервиса и политикой персональных данных.
            </p>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          <p className={styles.paymentNote}>
            {selectedPaymentMethod === 'SBP'
              ? 'Оплата через СБП / YooKassa'
              : 'Оплата банковской картой / YooKassa'}
          </p>
        </div>
      </aside>

      <CdekPvzPickerModal
        isOpen={isPvzOpen}
        onClose={() => setPvzOpen(false)}
        onSelect={(sel) => {
          if (import.meta.env.DEV) {
            console.debug('[Checkout] CDEK PVZ selected', sel);
          }
          void setPickupPoint({
            provider: 'CDEK',
            pvzId: sel.pvzCode,
            addressFull: sel.addressFull,
            raw: sel.raw
          });
          setPvzOpen(false);
        }}
        city={data.address?.city ?? 'Москва'}
      />

      <RecipientModal
        isOpen={isRecipientOpen}
        onClose={() => setRecipientOpen(false)}
        initial={data.recipient}
        onSave={updateRecipient}
      />

      <AddCardModal
        isOpen={isAddCardOpen}
        onClose={() => setAddCardOpen(false)}
        onSubmit={addCard}
      />
    </div>
  );
};
