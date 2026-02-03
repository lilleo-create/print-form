import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCartStore } from '../app/store/cartStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import { useAddressStore } from '../app/store/addressStore';
import { contactsApi } from '../shared/api/contactsApi';
import { Contact, PaymentIntent } from '../shared/types';
import { formatShortAddress } from '../shared/lib/formatShortAddress';
import { AddressModal } from '../shared/ui/address/AddressModal';
import { Button } from '../shared/ui/Button';
import styles from './CheckoutPage.module.css';

const contactSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  email: z.string().email('Введите корректный email').optional().or(z.literal(''))
});

type ContactFormValues = z.infer<typeof contactSchema>;

export const CheckoutPage = () => {
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const createOrder = useOrdersStore((state) => state.createOrder);
  const addresses = useAddressStore((state) => state.addresses);
  const selectedAddressId = useAddressStore((state) => state.selectedAddressId);
  const isModalOpen = useAddressStore((state) => state.isModalOpen);
  const openModal = useAddressStore((state) => state.openModal);
  const closeModal = useAddressStore((state) => state.closeModal);
  const loadAddresses = useAddressStore((state) => state.loadAddresses);
  const addAddress = useAddressStore((state) => state.addAddress);
  const selectAddress = useAddressStore((state) => state.selectAddress);
  const updateAddress = useAddressStore((state) => state.updateAddress);
  const removeAddress = useAddressStore((state) => state.removeAddress);
  const resetAddresses = useAddressStore((state) => state.reset);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [saveToProfile, setSaveToProfile] = useState(false);
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId);

  const contactForm = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });

  useEffect(() => {
    if (pathname !== '/checkout') {
      return;
    }
    if (!user) {
      resetAddresses();
      setContacts([]);
      return;
    }
    if (!token) {
      setContacts([]);
      return;
    }
    const controller = new AbortController();
    contactsApi
      .listByUser(user.id, controller.signal)
      .then((data) => {
        setContacts(data);
        if (data[0]) {
          contactForm.reset({ name: data[0].name, phone: data[0].phone, email: data[0].email ?? '' });
          return;
        }
        contactForm.reset({
          name: user.name ?? '',
          phone: user.phone ?? '',
          email: user.email ?? ''
        });
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === 'AbortError') {
          return;
        }
        if (typeof error === 'object' && error && 'status' in error && (error as { status?: number }).status === 401) {
          setContacts([]);
          return;
        }
      });
    return () => controller.abort();
  }, [contactForm, pathname, resetAddresses, token, user]);

  useEffect(() => {
    if (pathname !== '/checkout') {
      return undefined;
    }
    if (user && token) {
      const controller = new AbortController();
      loadAddresses(user.id, controller.signal);
      return () => controller.abort();
    }
    return undefined;
  }, [loadAddresses, pathname, token, user]);

  useEffect(() => {
    if (pathname !== '/checkout') {
      return;
    }
    if (!user || !token) {
      return;
    }
    if (user.address && addresses.length === 0) {
      void (async () => {
        const created = await addAddress({
          userId: user.id,
          addressText: user.address ?? '',
          coords: null
        });
        await selectAddress(user.id, created.id);
      })();
    }
  }, [addAddress, addresses.length, pathname, selectAddress, token, user]);

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
    let contact = contacts[0];
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

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Оформление заказа</h1>
          <p>Заполните контактные данные и подтвердите заказ.</p>
        </div>
        <div className={styles.content}>
          <div className={styles.forms}>
            <form className={styles.form} onSubmit={contactForm.handleSubmit(handleSaveContact)}>
              <h3>Контактные данные</h3>
              <label>
                Имя
                <input {...contactForm.register('name')} />
                {contactForm.formState.errors.name && (
                  <span>{contactForm.formState.errors.name.message}</span>
                )}
              </label>
              <label>
                Телефон
                <input {...contactForm.register('phone')} />
                {contactForm.formState.errors.phone && (
                  <span>{contactForm.formState.errors.phone.message}</span>
                )}
              </label>
              <label>
                Email (опционально)
                <input {...contactForm.register('email')} />
                {contactForm.formState.errors.email && (
                  <span>{contactForm.formState.errors.email.message}</span>
                )}
              </label>
              <Button type="submit">Сохранить контакт</Button>
              <label className={styles.saveProfile}>
                <input
                  type="checkbox"
                  checked={saveToProfile}
                  onChange={(event) => setSaveToProfile(event.target.checked)}
                />
                Сохранить в профиль
              </label>
            </form>

            <div className={styles.form}>
              <h3>Адрес доставки</h3>
              <button
                type="button"
                className={styles.addressSelector}
                onClick={openModal}
              >
                <span className={styles.marker}>📍</span>
                <span>
                  {selectedAddress
                    ? selectedAddress.isFavorite && selectedAddress.label
                      ? selectedAddress.label
                      : formatShortAddress(selectedAddress.addressText)
                    : 'Выберите адрес'}
                </span>
              </button>
            </div>
          </div>

          <aside className={styles.summary}>
            <h3>Ваш заказ</h3>
            <ul>
              {items.map((item) => (
                <li key={item.product.id}>
                  {item.product.title} × {item.quantity}
                  <span>{(item.product.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
                </li>
              ))}
            </ul>
            <div className={styles.total}>
              <span>Итого</span>
              <strong>{total.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <button className={styles.primaryButton} type="button" onClick={onSubmit}>
              Подтвердить заказ
            </button>
          </aside>
        </div>
      </div>
      {user && (
        <AddressModal
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
