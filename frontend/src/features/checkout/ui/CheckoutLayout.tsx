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
import styles from './CheckoutLayout.module.css';
import { formatPrice } from '../../../shared/lib/formatPrice';

export const CheckoutLayout = () => {
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
        <section className={styles.block}>
          <h2>Доставка</h2>

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

          <Button variant="ghost" onClick={() => setRecipientOpen(true)}>
            Получатель: {data.recipient.name || 'Указать'}
          </Button>
        </section>

        <DeliveryDatesSection items={data.cartItems} />
        <CheckoutItemsList items={data.cartItems} />
        <CheckoutLegalLinks accepted={legalAccepted} onAcceptedChange={setLegalAccepted} />
      </div>

      <aside className={styles.right}>
        <div className={styles.block}>
          <div className={styles.summary}>
            <div>Способ оплаты: {selectedPaymentMethod === 'SBP' ? 'СБП / YooKassa' : 'Банковская карта / YooKassa'}</div>
            <div>Итого: {formatPrice(total)}</div>

            <Button
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
          </div>
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
    </div>
  );
};
