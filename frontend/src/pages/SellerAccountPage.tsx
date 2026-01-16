import { useEffect, useMemo, useState } from 'react';
import { useOrdersStore } from '../app/store/ordersStore';
import { useProductsStore } from '../app/store/productsStore';
import { useAuthStore } from '../app/store/authStore';
import { addressesApi } from '../shared/api/addressesApi';
import { contactsApi } from '../shared/api/contactsApi';
import { Address, Contact, Order, Product } from '../shared/types';
import { SellerProductModal } from '../widgets/seller/SellerProductModal';
import styles from './SellerAccountPage.module.css';

interface SellerOrderGroup {
  order: Order;
  items: Order['items'];
  contact?: Contact;
  address?: Address;
}

export const SellerAccountPage = () => {
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const sellerProducts = useProductsStore((state) => state.sellerProducts);
  const loadProducts = useProductsStore((state) => state.loadProducts);
  const addProduct = useProductsStore((state) => state.addProduct);
  const updateProduct = useProductsStore((state) => state.updateProduct);
  const removeProduct = useProductsStore((state) => state.removeProduct);
  const orders = useOrdersStore((state) => state.orders);
  const loadSellerOrders = useOrdersStore((state) => state.loadSellerOrders);
  const user = useAuthStore((state) => state.user);
  const [contacts, setContacts] = useState<Record<string, Contact[]>>({});
  const [addresses, setAddresses] = useState<Record<string, Address[]>>({});

  useEffect(() => {
    loadProducts();
    if (user) {
      loadSellerOrders(user.id);
    }
  }, [loadProducts, loadSellerOrders, user]);

  useEffect(() => {
    const buyerIds = Array.from(new Set(orders.map((order) => order.buyerId)));
    if (buyerIds.length === 0) {
      setContacts({});
      setAddresses({});
      return;
    }

    Promise.all(buyerIds.map((buyerId) => contactsApi.listByUser(buyerId).then((list) => [buyerId, list])))
      .then((entries) => {
        setContacts(Object.fromEntries(entries));
      });

    Promise.all(buyerIds.map((buyerId) => addressesApi.listByUser(buyerId).then((list) => [buyerId, list])))
      .then((entries) => {
        setAddresses(Object.fromEntries(entries));
      });
  }, [orders]);

  const orderGroups = useMemo<SellerOrderGroup[]>(() => {
    if (!user) {
      return [];
    }
    return orders
      .map((order) => {
        const items = order.items.filter((item) => item.sellerId === user.id);
        const buyerContacts = contacts[order.buyerId] ?? [];
        const buyerAddresses = addresses[order.buyerId] ?? [];
        const contact = buyerContacts.find((entry) => entry.id === order.contactId);
        const address = buyerAddresses.find((entry) => entry.id === order.shippingAddressId);
        return { order, items, contact, address };
      })
      .filter((group) => group.items.length > 0);
  }, [addresses, contacts, orders, user]);

  const revenue = orderGroups.reduce((sum, group) => sum + group.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0), 0);

  const openCreate = () => {
    setActiveProduct(null);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setActiveProduct(product);
    setModalOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (window.confirm('Удалить товар?')) {
      await removeProduct(productId);
    }
  };

  const handleSubmit = async (product: Product) => {
    if (sellerProducts.some((item) => item.id === product.id)) {
      await updateProduct(product);
    } else {
      await addProduct(product);
    }
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Кабинет продавца</h1>
            <p>Управляйте товарами, заказами и статистикой.</p>
          </div>
          <div className={styles.stats}>
            <div>
              <span>Выручка</span>
              <strong>{revenue.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div>
              <span>Заказы</span>
              <strong>{orderGroups.length}</strong>
            </div>
            <div>
              <span>Товары</span>
              <strong>{sellerProducts.length}</strong>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Товары</h2>
            <button className={styles.addButton} onClick={openCreate}>
              + Добавить товар
            </button>
          </div>
          {sellerProducts.length === 0 ? (
            <p className={styles.empty}>Нет товаров. Добавьте первый товар.</p>
          ) : (
            <div className={styles.productGrid}>
              {sellerProducts.map((product) => (
                <div key={product.id} className={styles.productCard}>
                  <img src={product.image} alt={product.title} />
                  <div>
                    <h4>{product.title}</h4>
                    <p>{product.price.toLocaleString('ru-RU')} ₽</p>
                  </div>
                  <div className={styles.actions}>
                    <button onClick={() => openEdit(product)}>Редактировать</button>
                    <button onClick={() => handleDelete(product.id)}>Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2>Заказы</h2>
          {orderGroups.length === 0 ? (
            <p className={styles.empty}>Пока нет заказов.</p>
          ) : (
            <div className={styles.orderList}>
              {orderGroups.map(({ order, items, contact, address }) => (
                <div key={order.id} className={styles.orderCard}>
                  <div>
                    <h4>Заказ #{order.id}</h4>
                    <span>{order.createdAt}</span>
                    {contact && (
                      <p>
                        {contact.name} · {contact.phone}
                      </p>
                    )}
                    {address && (
                      <p>
                        {address.city}, {address.street} {address.house}
                      </p>
                    )}
                  </div>
                  <div>
                    <strong>
                      {items
                        .reduce((sum, item) => sum + item.lineTotal, 0)
                        .toLocaleString('ru-RU')} ₽
                    </strong>
                    <p>Позиции: {items.length}</p>
                  </div>
                  <div className={styles.orderItems}>
                    {items.map((item) => (
                      <span key={item.productId}>
                        {item.title} × {item.qty}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {isModalOpen && (
        <SellerProductModal
          product={activeProduct}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
};
