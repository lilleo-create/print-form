import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { useCheckoutStore } from '../model/useCheckoutStore';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';
import { AddressBlock } from './AddressBlock';
import { PickupPointBlock } from './PickupPointBlock';
import { CdekPvzPickerModal } from '../../../components/checkout/CdekPvzPickerModal';
import { RecipientModal } from './RecipientModal';
import { CheckoutLegalLinks } from './CheckoutLegalLinks';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import styles from './CheckoutLayout.module.css';
import { formatPrice } from '../../../shared/lib/formatPrice';
import { useBuyNowStore } from '../../../app/store/buyNowStore';
import { SmartImage } from '../../../shared/ui/SmartImage';

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
    placeOrder
  } = useCheckoutStore();

  const [isPvzOpen, setPvzOpen] = useState(false);
  const [isRecipientOpen, setRecipientOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    void fetchCheckout();
  }, [fetchCheckout]);

  const total = useMemo(
    () => data?.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0,
    [data?.cartItems]
  );

  const deliveryFee = 0;
  const selectedDeliveryMethod = data?.selectedDeliveryMethod ?? 'COURIER';
  const selectedPaymentMethod = data?.selectedPaymentMethod ?? 'CARD';
  const availableDeliveryMethods = data?.deliveryMethods ?? [];
  const firstItem = data?.cartItems[0];

  const fulfillmentLabel = useMemo(() => {
    if (!firstItem) return 'Способ доставки уточняется';
    if (selectedDeliveryMethod === 'PICKUP_POINT') {
      return 'Пункт выдачи';
    }
    if (firstItem.etaMinDays && firstItem.etaMaxDays) {
      return `Ориентировочно ${firstItem.etaMinDays}-${firstItem.etaMaxDays} дн.`;
    }
    if (firstItem.deliveryDays) {
      return `Ориентировочно ${firstItem.deliveryDays} дн.`;
    }
    return 'Срок уточняется';
  }, [firstItem, selectedDeliveryMethod]);

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
      <div className={styles.leftColumn}>
        <section className={styles.deliveryCard}>
          <header className={styles.cardHead}>
            <h2>{isBuyNowFlow ? 'Доставка · Купить сейчас' : 'Доставка'}</h2>
          </header>

          <DeliveryMethodSelector
            methods={availableDeliveryMethods}
            selected={selectedDeliveryMethod}
            onSelect={(code) => void setDeliveryMethod(code)}
          />

          {selectedDeliveryMethod === 'PICKUP_POINT' ? (
            <PickupPointBlock point={data.selectedPickupPoint ?? null} onOpen={() => setPvzOpen(true)} />
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

          <button type="button" className={styles.recipientTrigger} onClick={() => setRecipientOpen(true)}>
            <strong>Получатель</strong>
            <span>{data.recipient.name || 'Указать ФИО и контакты'}</span>
          </button>
        </section>

        <section className={styles.fulfillmentCard}>
          <div className={styles.fulfillmentTop}>
            <span className={styles.fulfillmentLabel}>{fulfillmentLabel}</span>
            <span className={styles.fulfillmentMethod}>
              {selectedDeliveryMethod === 'PICKUP_POINT' ? 'Самовывоз из ПВЗ' : 'Доставка'}
            </span>
          </div>

          {firstItem ? (
            <article className={styles.orderItem}>
              <SmartImage src={firstItem.image ?? ''} alt={firstItem.title} sizePreset="card" />
              <div className={styles.orderItemMeta}>
                <h3>{firstItem.title}</h3>
                <p>{firstItem.shortSpec ?? 'SKU/variant'}</p>
                <p>{firstItem.quantity} × {formatPrice(firstItem.price)}</p>
              </div>
              <strong>{formatPrice(firstItem.price * firstItem.quantity)}</strong>
            </article>
          ) : null}
        </section>

        <CheckoutLegalLinks accepted={legalAccepted} onAcceptedChange={setLegalAccepted} />
      </div>

      <aside className={styles.rightColumn}>
        <section className={styles.summaryCard}>
          <h3>Ваш заказ</h3>
          <p className={styles.summaryRow}><span>{data.cartItems.length} товар(а)</span><strong>{formatPrice(total)}</strong></p>
          <p className={styles.summaryRow}><span>Скидка / выгода</span><strong>−0 ₽</strong></p>
          <p className={styles.summaryRow}><span>Доставка и сервисы</span><strong>{formatPrice(deliveryFee)}</strong></p>
          <p className={styles.summaryTotal}><span>Итого</span><strong>{formatPrice(total + deliveryFee)}</strong></p>
        </section>

        <section className={styles.paymentCard}>
          <PaymentMethodSelector data={data} onSelectMethod={(method, cardId) => void setPaymentMethod(method, cardId)} />
          <p className={styles.paymentNote}>
            {selectedPaymentMethod === 'SBP' ? 'Оплата через СБП / YooKassa' : 'Оплата банковской картой / YooKassa'}
          </p>
        </section>

        <Button
          className={styles.payButton}
          isLoading={isSubmittingOrder || isPaying}
          disabled={isPaying || !legalAccepted}
          onClick={() => void handlePayClick()}
        >
          Оплатить
        </Button>

        {!legalAccepted ? (
          <p className={styles.error}>Подтвердите согласие с правилами сервиса и политикой персональных данных.</p>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </aside>

      <CdekPvzPickerModal
        isOpen={isPvzOpen}
        onClose={() => setPvzOpen(false)}
        onSelect={(sel) => {
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
    </div>
  );
};
