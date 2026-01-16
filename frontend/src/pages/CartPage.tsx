import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import styles from './CartPage.module.css';

export const CartPage = () => {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const handleCheckout = () => {
    if (!user) {
      navigate('/auth/login?redirectTo=/checkout');
      return;
    }
    navigate('/checkout');
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Корзина</h1>
          <p>Проверьте состав заказа перед оформлением.</p>
        </div>
        {items.length === 0 ? (
          <p className={styles.empty}>Корзина пуста.</p>
        ) : (
          <div className={styles.content}>
            <div className={styles.list}>
              {items.map((item) => (
                <div key={item.product.id} className={styles.item}>
                  <img src={item.product.image} alt={item.product.title} />
                  <div className={styles.info}>
                    <h3>{item.product.title}</h3>
                    <p>{item.product.price.toLocaleString('ru-RU')} ₽</p>
                  </div>
                  <div className={styles.controls}>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        updateQuantity(item.product.id, Number(event.target.value))
                      }
                    />
                    <button onClick={() => removeItem(item.product.id)}>Удалить</button>
                  </div>
                  <div className={styles.sum}>
                    {(item.product.price * item.quantity).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              ))}
            </div>
            <aside className={styles.summary}>
              <div>
                <span>Итого</span>
                <strong>{total.toLocaleString('ru-RU')} ₽</strong>
              </div>
              <button className={styles.cta} onClick={handleCheckout}>
                Оформить заказ
              </button>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
};
