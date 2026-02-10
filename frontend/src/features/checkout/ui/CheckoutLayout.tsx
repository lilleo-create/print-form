import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { useCheckoutStore } from '../model/useCheckoutStore';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';
import { AddressBlock } from './AddressBlock';
import { PickupPointBlock } from './PickupPointBlock';
import { PickupPointModal } from './PickupPointModal';
import { RecipientModal } from './RecipientModal';
import { DeliveryDatesSection } from './DeliveryDatesSection';
import { CheckoutItemsList } from './CheckoutItemsList';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { AddCardModal } from './AddCardModal';
import { CheckoutLegalLinks } from './CheckoutLegalLinks';
import styles from './CheckoutLayout.module.css';

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
    setPaymentMethod,
    addCard,
    placeOrder
  } = useCheckoutStore();

  const [isPickupModalOpen, setPickupModalOpen] = useState(false);
  const [isRecipientOpen, setRecipientOpen] = useState(false);
  const [isAddCardOpen, setAddCardOpen] = useState(false);

  useEffect(() => {
    void fetchCheckout();
  }, [fetchCheckout]);

  const total = useMemo(
    () => data?.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0,
    [data?.cartItems]
  );

  if (isLoading && !data) return <p className={styles.state}>Загрузка checkout…</p>;
  if (!data) return <p className={styles.state}>{error ?? 'Не удалось загрузить checkout'}</p>;

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        <section className={styles.block}>
          <h2>Доставка</h2>
          <DeliveryMethodSelector
            methods={data.deliveryMethods}
            selected={data.selectedDeliveryMethod ?? 'ADDRESS'}
            onSelect={(code) => void setDeliveryMethod(code)}
          />

          {data.selectedDeliveryMethod === 'PICKUP' ? (
            <PickupPointBlock point={data.selectedPickupPoint ?? null} onOpen={() => {
              setPickupModalOpen(true);
            }} />
          ) : (
            <AddressBlock
              address={data.address}
              onEdit={() => {
                void updateAddress(
                  data.address ?? { line1: '', city: 'Москва', postalCode: '125040', country: 'Россия' }
                );
              }}
            />
          )}

          <Button variant="ghost" onClick={() => setRecipientOpen(true)}>Получатель: {data.recipient.name || 'Указать'}</Button>
        </section>

        <DeliveryDatesSection items={data.cartItems} />
        <CheckoutItemsList items={data.cartItems} />
        <CheckoutLegalLinks />
      </div>

      <aside className={styles.right}>
        <PaymentMethodSelector
          data={data}
          onSelectMethod={(method, cardId) => void setPaymentMethod(method, cardId)}
          onOpenAddCard={() => setAddCardOpen(true)}
        />

        <div className={styles.summary}>
          <div>Итого: {total.toLocaleString('ru-RU')} ₽</div>
          <Button isLoading={isSubmittingOrder} onClick={() => void placeOrder()}>
            Пополнить и оплатить
          </Button>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </aside>

      <PickupPointModal
        isOpen={isPickupModalOpen}
        onClose={() => setPickupModalOpen(false)}
        selectedId={data.selectedPickupPoint?.id}
        onConfirm={(payload) => setPickupPoint(payload.pickupPointId, payload.provider)}
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
