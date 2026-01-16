import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import { addressesApi } from '../shared/api/addressesApi';
import { contactsApi } from '../shared/api/contactsApi';
import { Address, Contact, OrderStatus } from '../shared/types';
import { Button } from '../shared/ui/Button';
import styles from './BuyerAccountPage.module.css';

const statusMap: Record<OrderStatus, string> = {
  processing: 'В обработке',
  printing: 'В печати',
  shipped: 'Отправлен',
  delivered: 'Завершен'
};

const contactSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  email: z.string().email('Введите корректный email').optional().or(z.literal(''))
});

type ContactFormValues = z.infer<typeof contactSchema>;

const addressSchema = z.object({
  city: z.string().min(2, 'Город'),
  street: z.string().min(2, 'Улица'),
  house: z.string().min(1, 'Дом'),
  apt: z.string().optional(),
  comment: z.string().optional()
});

type AddressFormValues = z.infer<typeof addressSchema>;

export const BuyerAccountPage = () => {
  const loadOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const orders = useOrdersStore((state) => state.orders);
  const user = useAuthStore((state) => state.user);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const contactForm = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });
  const addressForm = useForm<AddressFormValues>({ resolver: zodResolver(addressSchema) });

  useEffect(() => {
    if (user) {
      loadOrders(user);
      contactsApi.listByUser(user.id).then((data) => {
        setContacts(data);
        if (data[0]) {
          contactForm.reset({
            name: data[0].name,
            phone: data[0].phone,
            email: data[0].email ?? ''
          });
        }
      });
      addressesApi.listByUser(user.id).then((data) => setAddresses(data));
    }
  }, [contactForm, loadOrders, user]);

  const primaryContact = useMemo(() => contacts[0], [contacts]);

  const handleSaveContact = async (values: ContactFormValues) => {
    if (!user) {
      return;
    }
    if (primaryContact) {
      const updated = await contactsApi.update({
        ...primaryContact,
        name: values.name,
        phone: values.phone,
        email: values.email || undefined
      });
      setContacts([updated]);
    } else {
      const created = await contactsApi.create({
        userId: user.id,
        name: values.name,
        phone: values.phone,
        email: values.email || undefined
      });
      setContacts([created]);
    }
  };

  const handleSaveAddress = async (values: AddressFormValues) => {
    if (!user) {
      return;
    }
    if (editingAddressId) {
      const existing = addresses.find((address) => address.id === editingAddressId);
      if (!existing) {
        return;
      }
      const updated = await addressesApi.update({
        ...existing,
        city: values.city,
        street: values.street,
        house: values.house,
        apt: values.apt,
        comment: values.comment
      });
      setAddresses(addresses.map((address) => (address.id === updated.id ? updated : address)));
      setEditingAddressId(null);
    } else {
      const created = await addressesApi.create({
        userId: user.id,
        city: values.city,
        street: values.street,
        house: values.house,
        apt: values.apt,
        comment: values.comment
      });
      setAddresses([created, ...addresses]);
    }
    addressForm.reset({ city: '', street: '', house: '', apt: '', comment: '' });
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddressId(address.id);
    addressForm.reset({
      city: address.city,
      street: address.street,
      house: address.house,
      apt: address.apt ?? '',
      comment: address.comment ?? ''
    });
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user || !window.confirm('Удалить адрес?')) {
      return;
    }
    await addressesApi.remove(user.id, addressId);
    setAddresses(addresses.filter((address) => address.id !== addressId));
    if (editingAddressId === addressId) {
      setEditingAddressId(null);
      addressForm.reset({ city: '', street: '', house: '', apt: '', comment: '' });
    }
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Личный кабинет</h1>
            <p>Профиль покупателя и история заказов.</p>
          </div>
          <div className={styles.profileCard}>
            <h4>{user?.name}</h4>
            <p>{user?.email}</p>
            <span>Статус: Premium</span>
          </div>
        </div>

        <div className={styles.profileGrid}>
          <form className={styles.profileBox} onSubmit={contactForm.handleSubmit(handleSaveContact)}>
            <h3>Личные данные</h3>
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
              Email
              <input {...contactForm.register('email')} />
              {contactForm.formState.errors.email && (
                <span>{contactForm.formState.errors.email.message}</span>
              )}
            </label>
            <Button type="submit">Сохранить</Button>
          </form>

          <div className={styles.profileBox}>
            <div className={styles.addressHeader}>
              <h3>Адреса доставки</h3>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setEditingAddressId(null);
                  addressForm.reset({ city: '', street: '', house: '', apt: '', comment: '' });
                }}
              >
                Добавить адрес
              </button>
            </div>
            {addresses.length === 0 ? (
              <p className={styles.empty}>Адресов пока нет.</p>
            ) : (
              <div className={styles.addressList}>
                {addresses.map((address) => (
                  <div key={address.id} className={styles.addressItem}>
                    <div>
                      <p>
                        {address.city}, {address.street} {address.house}
                      </p>
                      {address.apt && <p>Кв. {address.apt}</p>}
                      {address.comment && <p>{address.comment}</p>}
                    </div>
                    <div className={styles.addressActions}>
                      <button type="button" onClick={() => handleEditAddress(address)}>
                        Редактировать
                      </button>
                      <button type="button" onClick={() => handleDeleteAddress(address.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form className={styles.addressForm} onSubmit={addressForm.handleSubmit(handleSaveAddress)}>
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
              <Button type="submit">
                {editingAddressId ? 'Сохранить изменения' : 'Сохранить адрес'}
              </Button>
            </form>
          </div>
        </div>

        <h2>История заказов</h2>
        <div className={styles.orders}>
          {orders.length === 0 ? (
            <p className={styles.empty}>Пока нет заказов.</p>
          ) : (
            orders.map((order) => (
              <article key={order.id} className={styles.orderCard}>
                <div>
                  <h4>Заказ #{order.id}</h4>
                  <p>{order.createdAt}</p>
                </div>
                <div>
                  <strong>{statusMap[order.status]}</strong>
                  <p>{order.total.toLocaleString('ru-RU')} ₽</p>
                </div>
                <div className={styles.items}>
                  {order.items.map((item) => (
                    <span key={item.productId}>
                      {item.title} × {item.qty}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
