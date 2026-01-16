import { useEffect, useMemo, useState } from 'react';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import { addressesApi } from '../shared/api/addressesApi';
import { contactsApi } from '../shared/api/contactsApi';
import { Address, Contact, OrderStatus } from '../shared/types';
import styles from './BuyerAccountPage.module.css';

const statusMap: Record<OrderStatus, string> = {
  processing: 'В обработке',
  printing: 'В печати',
  shipped: 'Отправлен',
  delivered: 'Завершен'
};

export const BuyerAccountPage = () => {
  const loadOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const orders = useOrdersStore((state) => state.orders);
  const user = useAuthStore((state) => state.user);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    if (user) {
      loadOrders(user);
      contactsApi.listByUser(user.id).then(setContacts);
      addressesApi.listByUser(user.id).then(setAddresses);
    }
  }, [loadOrders, user]);

  const contact = useMemo(() => contacts[0], [contacts]);
  const address = useMemo(() => addresses[0], [addresses]);

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
          <div className={styles.profileBox}>
            <h3>Контакт</h3>
            {contact ? (
              <>
                <p>{contact.name}</p>
                <p>{contact.phone}</p>
                {contact.email && <p>{contact.email}</p>}
              </>
            ) : (
              <p className={styles.empty}>Контакт не сохранен.</p>
            )}
          </div>
          <div className={styles.profileBox}>
            <h3>Адрес доставки</h3>
            {address ? (
              <>
                <p>{address.label}</p>
                <p>
                  {address.city}, {address.street} {address.house}
                </p>
                {address.apt && <p>Кв. {address.apt}</p>}
                {address.comment && <p>{address.comment}</p>}
              </>
            ) : (
              <p className={styles.empty}>Адрес не сохранен.</p>
            )}
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
