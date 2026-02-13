import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useOrdersStore } from '../../app/store/ordersStore';
import { useAuthStore } from '../../app/store/authStore';
import { useAddressStore } from '../../app/store/addressStore';
import { contactsApi } from '../../shared/api/contactsApi';
import { api } from '../../shared/api';
import type { Contact, PaymentIntent } from '../../shared/types';
import { formatShortAddress } from '../../shared/lib/formatShortAddress';
import styles from '../../pages/CheckoutPage.module.css';
import { useCheckoutPrefill } from '../../hooks/checkout/useCheckoutPrefill';
import { ContactForm } from './ContactForm';
import { ShippingAddressCard } from './ShippingAddressCard';
import { OrderSummary } from './OrderSummary';
import { CheckoutHeader } from './CheckoutHeader';
import { CheckoutAddressModalGate } from './CheckoutAddressModalGate';
import type { ContactFormValues } from './types';
import {
  isRuPhone,
  toE164Ru,
  isValidEmailOptional,
  normalizePhone
} from '../../shared/lib/validation';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Введите имя'),
  phone: z
    .string()
    .trim()
    .min(1, 'Введите телефон')
    .refine(isRuPhone, 'Введите корректный номер телефона'),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((v) => isValidEmailOptional(v), 'Введите корректный email')
});

export const CheckoutPageLayout = () => {
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);

  const createOrder = useOrdersStore((state) => state.createOrder);

  const addAddress = useAddressStore((state) => state.addAddress);
  const selectAddress = useAddressStore((state) => state.selectAddress);
  const updateAddress = useAddressStore((state) => state.updateAddress);
  const removeAddress = useAddressStore((state) => state.removeAddress);

  const navigate = useNavigate();
  const [isEditingContact, setIsEditingContact] = useState(false);

  const {
    contacts,
    setContacts,
    addresses,
    selectedAddressId,
    isModalOpen,
    openModal,
    closeModal
  } = useCheckoutPrefill({
    user,
    keepPreviousData: true,
    ttlMs: 60000
  });

  const selectedAddress = addresses.find(
    (address) => address.id === selectedAddressId
  );

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', phone: '', email: '' },
    mode: 'onBlur'
  });

  const prefillSignatureRef = useRef<string>('');

  useEffect(() => {
    if (!user) return;

    const firstContact = contacts[0];
    const phonePrefill = firstContact?.phone ?? user.phone ?? '';

    const nextValues: ContactFormValues = {
      name: firstContact?.name ?? user.name ?? '',
      phone: phonePrefill,
      email: firstContact?.email ?? user.email ?? ''
    };

    const signature = `${user.id}:${firstContact?.id ?? 'none'}:${nextValues.name}:${nextValues.phone}:${nextValues.email}`;
    if (prefillSignatureRef.current === signature) return;

    prefillSignatureRef.current = signature;
    contactForm.reset(nextValues, { keepDirtyValues: true });

    // если телефон кривой — сразу открываем редактирование
    setIsEditingContact(!contactSchema.safeParse(nextValues).success);
  }, [contacts, contactForm, user]);

  const total = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const ensureContactUpToDate = async (): Promise<Contact | null> => {
    if (!user) return null;

    const raw = contactForm.getValues();

    // прогоняем валидацию и показываем ошибки
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        const field = i.path[0] as keyof ContactFormValues;
        contactForm.setError(field, { message: i.message });
      });
      return null;
    }

    const name = raw.name.trim();
    const phone = toE164Ru(raw.phone);
    const email = raw.email?.trim() || undefined;

    const existing = contacts[0];

    // если контакт есть и данные не изменились -> ничего не дергаем
    if (existing) {
      const sameName = (existing.name ?? '').trim() === name;
      const sameEmail = (existing.email ?? '') === (email ?? '');
      const samePhone =
        normalizePhone(existing.phone ?? '') === normalizePhone(phone);

      if (sameName && sameEmail && samePhone) return existing;

      const updated = await contactsApi.update({
        ...existing,
        name,
        phone,
        email
      });

      setContacts([updated]);
      return updated;
    }

    // если контакта нет - создаем
    const created = await contactsApi.create({
      userId: user.id,
      name,
      phone,
      email
    });

    setContacts([created]);
    return created;
  };

  const onSubmit = async () => {
    if (!user || items.length === 0) return;
    if (!selectedAddressId) return;

    // 1) Если НЕ редактируем — проверим схему без триггера
    if (!isEditingContact) {
      const raw = contactForm.getValues();
      const parsed = contactSchema.safeParse(raw);

      if (!parsed.success) {
        // включаем редактирование и показываем ошибки
        setIsEditingContact(true);

        // проставим ошибки
        parsed.error.issues.forEach((i) => {
          const field = i.path[0] as keyof ContactFormValues;
          contactForm.setError(field, { message: i.message });
        });

        // фокус на первом поле с ошибкой
        const first = parsed.error.issues[0]?.path[0] as
          | keyof ContactFormValues
          | undefined;
        if (first) contactForm.setFocus(first);

        return;
      }
    }

    // 2) Если редактируем — обычный trigger (чтобы сразу подсветить)
    const ok = await contactForm.trigger(['name', 'phone', 'email']);
    if (!ok) return;

    const contact = await ensureContactUpToDate();
    if (!contact) return;

    const orderItems = items.map((item) => ({
      productId: item.product.id,
      title: item.product.title,
      price: item.product.price,
      qty: item.quantity,
      sellerId: item.product.sellerId ?? 'platform',
      lineTotal: item.product.price * item.quantity,
      image: item.product.image
    }));

    const order = await createOrder({
      user,
      contactId: contact.id,
      shippingAddressId: selectedAddressId,
      items: orderItems,
      total
    });

    let createdPaymentIntent: PaymentIntent | null = null;
    try {
      const paymentResponse = await api.createPaymentIntent({
        orderId: order.id,
        amount: order.total,
        currency: 'RUB'
      });
      createdPaymentIntent = paymentResponse.data;
    } catch {
      createdPaymentIntent = null;
    }

    clear();
    navigate('/orders', { state: { paymentIntent: createdPaymentIntent } });
  };

  const selectedAddressText = selectedAddress
    ? selectedAddress.label?.trim()
      ? selectedAddress.label.trim()
      : formatShortAddress(selectedAddress.addressText)
    : 'Выберите адрес';

  return (
    <section className={styles.page}>
      <div className="container">
        <CheckoutHeader />

        <div className={styles.content}>
          <div className={styles.forms}>
            {/* "как в профиле": блок с карандашом */}
            <div className={styles.form}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <h3 style={{ margin: 0 }}>Контактные данные</h3>
                <button
                  type="button"
                  className={styles.editButton ?? ''}
                  onClick={() => setIsEditingContact((prev) => !prev)}
                  aria-label="Редактировать контактные данные"
                >
                  ✎
                </button>
              </div>

              <ContactForm form={contactForm} disabled={!isEditingContact} />
            </div>
          </div>
          <div>
            <ShippingAddressCard
              selectedAddressText={selectedAddressText}
              onOpenModal={openModal}
            />
            <OrderSummary
              items={items}
              total={total}
              onConfirm={onSubmit}
              disabled={!items.length}
            />
          </div>
        </div>
      </div>

      {user && (
        <CheckoutAddressModalGate
          isOpen={isModalOpen}
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          userId={user.id}
          onClose={closeModal}
          onSelect={(addressId) => selectAddress(user.id, addressId)}
          onCreate={async (payload) => {
            const created = await addAddress(payload);
            await selectAddress(user.id, created.id);
            return created;
          }}
          onUpdate={updateAddress}
          onDelete={async (addressId) => {
            const nextAddresses = addresses.filter(
              (address) => address.id !== addressId
            );
            await removeAddress(user.id, addressId);
            if (selectedAddressId === addressId) {
              const fallbackId = nextAddresses[0]?.id ?? '';
              if (fallbackId) await selectAddress(user.id, fallbackId);
            }
          }}
        />
      )}
    </section>
  );
};
