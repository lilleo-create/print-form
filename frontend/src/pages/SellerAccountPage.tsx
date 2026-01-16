import { useEffect, useState } from 'react';
import { useOrdersStore } from '../app/store/ordersStore';
import { useProductsStore } from '../app/store/productsStore';
import { useAuthStore } from '../app/store/authStore';
import { Product } from '../shared/types';
import { SellerProductModal } from '../widgets/seller/SellerProductModal';
import styles from './SellerAccountPage.module.css';

export const SellerAccountPage = () => {
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const sellerProducts = useProductsStore((state) => state.sellerProducts);
  const loadProducts = useProductsStore((state) => state.loadProducts);
  const addProduct = useProductsStore((state) => state.addProduct);
  const updateProduct = useProductsStore((state) => state.updateProduct);
  const removeProduct = useProductsStore((state) => state.removeProduct);
  const orders = useOrdersStore((state) => state.orders);
  const loadOrders = useOrdersStore((state) => state.loadOrders);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadProducts();
    if (user) {
      loadOrders(user);
    }
  }, [loadProducts, loadOrders, user]);

  const revenue = orders.reduce((sum, order) => sum + order.total, 0);

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
              <strong>{orders.length}</strong>
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
        </div>

        <div className={styles.section}>
          <h2>Заказы</h2>
          <div className={styles.orderList}>
            {orders.map((order) => (
              <div key={order.id} className={styles.orderCard}>
                <div>
                  <h4>Заказ #{order.id}</h4>
                  <span>{order.createdAt}</span>
                </div>
                <div>
                  <strong>{order.total.toLocaleString('ru-RU')} ₽</strong>
                  <p>Позиции: {order.items.length}</p>
                </div>
              </div>
            ))}
          </div>
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
