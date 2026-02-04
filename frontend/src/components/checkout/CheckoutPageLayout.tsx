import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
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

const contactSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  email: z.string().email('Введите корректный email').optional().or(z.literal(''))
});

type CheckoutPageLayoutProps = {
  pathname?: string;
};

export const CheckoutPageLayout = ({ pathname }: CheckoutPageLayoutProps) => {
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const createOrder = useOrdersStore((state) => state.createOrder);
  const addAddress = useAddressStore((state) => state.addAddress);
  const selectAddress = useAddressStore((state) => state.selectAddress);
  const updateAddress = useAddressStore((state) => state.updateAddress);
  const removeAddress = useAddressStore((state) => state.removeAddress);
  const { pathname: locationPath } = useLocation();
  const navigate = useNavigate();
  const [saveToProfile, setSaveToProfile] = useState(false);

  const resolvedPathname = pathname ?? locationPath;

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
    token,
    pathname: resolvedPathname,
    keepPreviousData: true,
    ttlMs: 60000
  });

  const selectedAddress = addresses.find((address) => address.id === selectedAddressId);

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', phone: '', email: '' }
  });

  const prefillSignatureRef = useRef<string>('');

  useEffect(() => {
    if (!user) return;
    const firstContact = contacts[0];
    const nextValues: ContactFormValues = {
      name: firstContact?.name ?? user.name ?? '',
      phone: firstContact?.phone ?? user.phone ?? '',
      email: firstContact?.email ?? user.email ?? ''
    };
    const signature = `${user.id}:${firstContact?.id ?? 'none'}:${nextValues.name}:${nextValues.phone}:${nextValues.email}`;
    if (prefillSignatureRef.current === signature) return;
    prefillSignatureRef.current = signature;
    contactForm.reset(nextValues, { keepDirtyValues: true });
  }, [contacts, contactForm, user]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const handleSaveContact = async (values: ContactFormValues) => {
    if (!user) {
      return;
    }
    const existing = contacts[0];
    if (existing) {
      const updated = await contactsApi.update({
        ...existing,
        name: values.name,
        phone: values.phone,
        email: values.email || undefined
      });
      setContacts([updated]);
      return;
    }
    const created = await contactsApi.create({
      userId: user.id,
      name: values.name,
      phone: values.phone,
      email: values.email || undefined
    });
    setContacts([created]);
  };

  const onSubmit = async () => {
    if (!user || items.length === 0) {
      return;
    }
    let contact: Contact | undefined = contacts[0];
    if (!contact) {
      const values = contactForm.getValues();
      if (!values.name || !values.phone) {
        return;
      }
      contact = await contactsApi.create({
        userId: user.id,
        name: values.name,
        phone: values.phone,
        email: values.email || undefined
      });
      setContacts([contact]);
    } else {
      const values = contactForm.getValues();
      if (values.name && values.phone) {
        contact = await contactsApi.update({
          ...contact,
          name: values.name,
          phone: values.phone,
          email: values.email || undefined
        });
        setContacts([contact]);
      }
    }
    if (!selectedAddressId) {
      return;
    }
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
    if (saveToProfile) {
      const values = contactForm.getValues();
      await updateProfile({
        name: values.name,
        phone: values.phone,
        address: selectedAddress?.addressText ?? user.address ?? undefined
      });
    }
    clear();
    navigate('/orders', { state: { paymentIntent: createdPaymentIntent } });
  };

  const selectedAddressText = selectedAddress
    ? selectedAddress.isFavorite && selectedAddress.label
      ? selectedAddress.label
      : formatShortAddress(selectedAddress.addressText)
    : 'Выберите адрес';

  return (
    <section className={styles.page}>
      <div className="container">
        <CheckoutHeader />
        <div className={styles.content}>
          <div className={styles.forms}>
            <ContactForm
              form={contactForm}
              onSave={handleSaveContact}
              saveToProfile={saveToProfile}
              onToggleSaveToProfile={setSaveToProfile}
            />
            <ShippingAddressCard selectedAddressText={selectedAddressText} onOpenModal={openModal} />
          </div>
          <OrderSummary items={items} total={total} onConfirm={onSubmit} disabled={!items.length} />
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
            const nextAddresses = addresses.filter((address) => address.id !== addressId);
            await removeAddress(user.id, addressId);
            if (selectedAddressId === addressId) {
              const fallbackId = nextAddresses[0]?.id ?? '';
              if (fallbackId) {
                await selectAddress(user.id, fallbackId);
              }
            }
          }}
        />
      )}
    </section>
  );
};
