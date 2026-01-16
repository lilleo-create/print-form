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
import { AddressPickerMap } from '../shared/ui/AddressPickerMap';
import { Button } from '../shared/ui/Button';
import styles from './CheckoutPage.module.css';

const contactSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  email: z.string().email('Введите корректный email').optional().or(z.literal(''))
});

const addressSchema = z.object({
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
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [addressCoords, setAddressCoords] = useState<Address['coords'] | null>(null);

  const contactForm = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });
  const addressForm = useForm<AddressFormValues>({ resolver: zodResolver(addressSchema) });

  useEffect(() => {
    if (!user) {
      return;
    }
    contactsApi.listByUser(user.id).then((data) => {
      setContacts(data);
      if (data[0]) {
        contactForm.reset({ name: data[0].name, phone: data[0].phone, email: data[0].email ?? '' });
      }
    });
    addressesApi.listByUser(user.id).then((data) => {
      setAddresses(data);
      addressesApi.getDefault(user.id).then((defaultId) => {
        setSelectedAddressId(defaultId ?? (data[0]?.id ?? ''));
      });
      if (data.length === 0) {
        setShowAddressForm(false);
      }
    });
  }, [contactForm, user]);

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

  const handleSaveAddress = async (values: AddressFormValues) => {
    if (!user) {
      return;
    }
    const created = await addressesApi.create({
      userId: user.id,
      city: values.city,
      street: values.street,
      house: values.house,
      apt: values.apt,
      comment: values.comment,
      coords: addressCoords ?? undefined
    });
    const nextAddresses = [created, ...addresses];
    setAddresses(nextAddresses);
    setSelectedAddressId(created.id);
    await addressesApi.setDefault(user.id, created.id);
    addressForm.reset({ city: '', street: '', house: '', apt: '', comment: '' });
    setAddressCoords(null);
    setShowAddressForm(false);
    setShowMapPicker(false);
  };

  const handleCancelAddress = () => {
    addressForm.reset({ city: '', street: '', house: '', apt: '', comment: '' });
    setAddressCoords(null);
    setShowAddressForm(false);
    setShowMapPicker(false);
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
      image: item.product.image,
      status: 'new'
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
                          {address.city}, {address.street} {address.house}
                          {address.apt ? `, кв. ${address.apt}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setShowAddressForm(true);
                      setShowMapPicker(false);
                      setAddressCoords(null);
                      addressForm.reset({ city: '', street: '', house: '', apt: '', comment: '' });
                    }}
                  >
                    Добавить новый адрес
                  </button>
                </>
              ) : (
                <>
                  {addresses.length === 0 && !showAddressForm ? (
                    <div className={styles.emptyState}>
                      <p>Адресов пока нет.</p>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                          setShowAddressForm(true);
                          setShowMapPicker(false);
                          setAddressCoords(null);
                          addressForm.reset({ city: '', street: '', house: '', apt: '', comment: '' });
                        }}
                      >
                        Добавить адрес
                      </button>
                    </div>
                  ) : (
                    showAddressForm && (
                      <form onSubmit={addressForm.handleSubmit(handleSaveAddress)}>
                        <div className={styles.addressGrid}>
                          <label>
                            Город
                            <input {...addressForm.register('city')} />
                            {addressForm.formState.errors.city && (
                              <span>{addressForm.formState.errors.city.message}</span>
                            )}
                          </label>
                          <label>
                            Улица
                            <input {...addressForm.register('street')} />
                            {addressForm.formState.errors.street && (
                              <span>{addressForm.formState.errors.street.message}</span>
                            )}
                          </label>
                          <label>
                            Дом
                            <input {...addressForm.register('house')} />
                            {addressForm.formState.errors.house && (
                              <span>{addressForm.formState.errors.house.message}</span>
                            )}
                          </label>
                          <label>
                            Квартира
                            <input {...addressForm.register('apt')} />
                          </label>
                          <label>
                            Комментарий
                            <input {...addressForm.register('comment')} />
                          </label>
                        </div>
                        <div className={styles.addressActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setShowMapPicker((prev) => !prev)}
                          >
                            Выбрать на карте
                          </button>
                        </div>
                        {showMapPicker && (
                          <AddressPickerMap
                            initialCoords={addressCoords ?? undefined}
                            onConfirm={(data) => {
                              addressForm.setValue('city', data.city);
                              addressForm.setValue('street', data.street);
                              addressForm.setValue('house', data.house);
                              setAddressCoords(data.coords);
                              setShowMapPicker(false);
                            }}
                            onCancel={() => setShowMapPicker(false)}
                          />
                        )}
                        <div className={styles.formActions}>
                          <Button type="submit">Сохранить адрес</Button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleCancelAddress}
                          >
                            Отмена
                          </button>
                        </div>
                      </form>
                    )
                  )}
                </>
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
            <button className={styles.primaryButton} type="button" onClick={onSubmit}>
              Подтвердить заказ
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
};
