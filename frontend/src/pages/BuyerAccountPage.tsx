import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOrdersStore } from '../app/store/ordersStore';
import { useProductsStore } from '../app/store/productsStore';
import { useAuthStore } from '../app/store/authStore';
import { addressesApi } from '../shared/api/addressesApi';
import { contactsApi } from '../shared/api/contactsApi';
import { Address, Contact, OrderItemStatus, OrderStatus } from '../shared/types';
import { formatAddress } from '../shared/lib/formatAddress';
import { AddressModal } from '../shared/ui/AddressModal';
import { Button } from '../shared/ui/Button';
import styles from './BuyerAccountPage.module.css';

const statusMap: Record<OrderStatus, string> = {
  processing: 'В обработке',
  printing: 'В печати',
  shipped: 'Отправлен',
  delivered: 'Завершен'
};

const itemStatusMap: Record<OrderItemStatus, string> = {
  new: 'Новый',
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

export const BuyerAccountPage = () => {
  const loadOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const orders = useOrdersStore((state) => state.orders);
  const allProducts = useProductsStore((state) => state.allProducts);
  const loadProducts = useProductsStore((state) => state.loadProducts);
  const user = useAuthStore((state) => state.user);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId);

  const contactForm = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });
  useEffect(() => {
    if (user) {
      loadOrders(user);
      loadProducts();
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
      addressesApi.listByUser(user.id).then((data) => {
        setAddresses(data);
        addressesApi.getDefault(user.id).then((defaultId) => {
          setSelectedAddressId(defaultId ?? (data[0]?.id ?? ''));
        });
      });
    }
  }, [contactForm, loadOrders, loadProducts, user]);

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

  const handleDeleteAddress = async (addressId: string) => {
    if (!user || !window.confirm('Удалить адрес?')) {
      return;
    }
    await addressesApi.remove(user.id, addressId);
    const next = addresses.filter((address) => address.id !== addressId);
    setAddresses(next);
    if (selectedAddressId === addressId) {
      const fallbackId = next[0]?.id ?? '';
      setSelectedAddressId(fallbackId);
      if (fallbackId) {
        await addressesApi.setDefault(user.id, fallbackId);
      }
    }
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Личный кабинет</h1>
            <p>Управляйте личными данными и заказами.</p>
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
            </div>
            <button
              type="button"
              className={styles.addressSelector}
              onClick={() => setIsAddressModalOpen(true)}
            >
              <span className={styles.marker}>📍</span>
              <span>
                {selectedAddress ? formatAddress(selectedAddress) : 'Выберите адрес'}
              </span>
            </button>
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
                  {order.items.map((item) => {
                    const fallbackImage =
                      item.image ?? allProducts.find((product) => product.id === item.productId)?.image;
                    return (
                      <div key={`${order.id}-${item.productId}`} className={styles.orderItem}>
                        {fallbackImage ? (
                          <img src={fallbackImage} alt={item.title} className={styles.orderItemImage} />
                        ) : (
                          <div className={styles.orderItemPlaceholder} aria-hidden="true">
                            Нет фото
                          </div>
                        )}
                      <div className={styles.orderItemInfo}>
                        <span className={styles.orderItemTitle}>{item.title}</span>
                        <span className={styles.orderItemMeta}>
                          {item.price.toLocaleString('ru-RU')} ₽ · {item.qty} шт.
                        </span>
                      </div>
                      <span className={styles.orderItemStatus}>
                        {itemStatusMap[item.status ?? 'new']}
                      </span>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
      {user && (
        <AddressModal
          isOpen={isAddressModalOpen}
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          userId={user.id}
          onClose={() => setIsAddressModalOpen(false)}
          onSelect={(addressId) => {
            setSelectedAddressId(addressId);
            addressesApi.setDefault(user.id, addressId);
          }}
          onCreate={async (payload) => {
            const created = await addressesApi.create(payload);
            setAddresses([created, ...addresses]);
            setSelectedAddressId(created.id);
            await addressesApi.setDefault(user.id, created.id);
            return created;
          }}
          onUpdate={async (payload) => {
            const updated = await addressesApi.update(payload);
            setAddresses(addresses.map((address) => (address.id === updated.id ? updated : address)));
            return updated;
          }}
          onDelete={handleDeleteAddress}
        />
      )}
    </section>
  );
};
