import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../app/store/cartStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import { addressesApi } from '../shared/api/addressesApi';
import { contactsApi } from '../shared/api/contactsApi';
import { Address, Contact } from '../shared/types';
import styles from './CheckoutPage.module.css';

const contactSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  email: z.string().email('Введите корректный email').optional().or(z.literal(''))
});

const addressSchema = z.object({
  label: z.string().min(2, 'Например, Дом'),
  city: z.string().min(2, 'Город'),
  street: z.string().min(2, 'Улица'),
  house: z.string().min(1, 'Дом'),
  apt: z.string().optional(),
  comment: z.string().optional()
});

type ContactFormValues = z.infer<typeof contactSchema>;

type AddressFormValues = z.infer<typeof addressSchema>;

export const CheckoutPage = () => {
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const createOrder = useOrdersStore((state) => state.createOrder);
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  const {
    register: registerContact,
    handleSubmit: handleContactSubmit,
    formState: { errors: contactErrors },
    reset: resetContact
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });

  const {
    register: registerAddress,
    handleSubmit: handleAddressSubmit,
    formState: { errors: addressErrors },
    reset: resetAddress
  } = useForm<AddressFormValues>({ resolver: zodResolver(addressSchema) });

  useEffect(() => {
    if (!user) {
      return;
    }
    contactsApi.listByUser(user.id).then((data) => {
      setContacts(data);
      if (data[0]) {
        resetContact({ name: data[0].name, phone: data[0].phone, email: data[0].email ?? '' });
      }
    });
    addressesApi.listByUser(user.id).then((data) => {
      setAddresses(data);
      addressesApi.getDefault(user.id).then((defaultId) => {
        setSelectedAddressId(defaultId ?? (data[0]?.id ?? ''));
      });
    });
  }, [resetContact, user]);

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
      setContacts([{ ...existing, ...values }]);
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

  const handleSaveAddress = async (values: AddressFormValues) => {
    if (!user) {
      return;
    }
    const created = await addressesApi.create({
      userId: user.id,
      label: values.label,
      city: values.city,
      street: values.street,
      house: values.house,
      apt: values.apt,
      comment: values.comment
    });
    const nextAddresses = [created, ...addresses];
    setAddresses(nextAddresses);
    setSelectedAddressId(created.id);
    await addressesApi.setDefault(user.id, created.id);
    resetAddress({ label: '', city: '', street: '', house: '', apt: '', comment: '' });
    setShowAddressForm(false);
  };

  const onSubmit = async () => {
    if (!user || items.length === 0) {
      return;
    }
    const contact = contacts[0];
    if (!contact || !selectedAddressId) {
      return;
    }
    const orderItems = items.map((item) => ({
      productId: item.product.id,
      title: item.product.title,
      price: item.product.price,
      qty: item.quantity,
      sellerId: item.product.sellerId ?? 'platform',
      lineTotal: item.product.price * item.quantity
    }));
    await createOrder({
      user,
      contactId: contact.id,
      shippingAddressId: selectedAddressId,
      items: orderItems,
      total
    });
    clear();
    navigate('/account');
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
            <form className={styles.form} onBlur={handleContactSubmit(handleSaveContact)}>
              <h3>Контактные данные</h3>
              <label>
                Имя
                <input {...registerContact('name')} />
                {contactErrors.name && <span>{contactErrors.name.message}</span>}
              </label>
              <label>
                Телефон
                <input {...registerContact('phone')} />
                {contactErrors.phone && <span>{contactErrors.phone.message}</span>}
              </label>
              <label>
                Email (опционально)
                <input {...registerContact('email')} />
                {contactErrors.email && <span>{contactErrors.email.message}</span>}
              </label>
            </form>

            <div className={styles.form}>
              <h3>Адрес доставки</h3>
              {addresses.length > 0 && !showAddressForm ? (
                <>
                  <label>
                    Выберите адрес
                    <select
                      value={selectedAddressId}
                      onChange={(event) => {
                        setSelectedAddressId(event.target.value);
                        if (user) {
                          addressesApi.setDefault(user.id, event.target.value);
                        }
                      }}
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} — {address.city}, {address.street} {address.house}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setShowAddressForm(true)}
                  >
                    Добавить новый адрес
                  </button>
                </>
              ) : (
                <form onSubmit={handleAddressSubmit(handleSaveAddress)}>
                  <div className={styles.addressGrid}>
                    <label>
                      Метка
                      <input {...registerAddress('label')} />
                      {addressErrors.label && <span>{addressErrors.label.message}</span>}
                    </label>
                    <label>
                      Город
                      <input {...registerAddress('city')} />
                      {addressErrors.city && <span>{addressErrors.city.message}</span>}
                    </label>
                    <label>
                      Улица
                      <input {...registerAddress('street')} />
                      {addressErrors.street && <span>{addressErrors.street.message}</span>}
                    </label>
                    <label>
                      Дом
                      <input {...registerAddress('house')} />
                      {addressErrors.house && <span>{addressErrors.house.message}</span>}
                    </label>
                    <label>
                      Квартира
                      <input {...registerAddress('apt')} />
                    </label>
                    <label>
                      Комментарий
                      <input {...registerAddress('comment')} />
                    </label>
                  </div>
                  <button type="submit">Сохранить адрес</button>
                </form>
              )}
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
            <button
              className={styles.primaryButton}
              type="button"
              onClick={handleContactSubmit(onSubmit)}
            >
              Подтвердить заказ
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
};
