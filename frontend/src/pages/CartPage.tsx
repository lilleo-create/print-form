import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import { useBuyNowStore } from '../app/store/buyNowStore';
import styles from './CartPage.module.css';
import { getProductMainImage } from '../shared/lib/productMedia';
import { SmartImage } from '../shared/ui/SmartImage';
import { formatPrice } from '../utils/money';

export const CartPage = () => {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const user = useAuthStore((state) => state.user);
  const clearBuyNow = useBuyNowStore((state) => state.clear);
  const navigate = useNavigate();

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const discount = 0;
  const delivery = items.length > 0 ? 149 : 0;
  const total = subtotal - discount + delivery;

  const handleCheckout = () => {
    clearBuyNow();
    if (!user) {
      navigate('/auth/login?redirectTo=/checkout');
      return;
    }
    navigate('/checkout');
  };

  return (
    <section className={styles.page}>
      <div className={`container ${styles.container}`}>
        <h1 className={styles.title}>Корзина</h1>
        {items.length === 0 ? (
          <p className={styles.empty}>Корзина пуста.</p>
        ) : (
          <div className={styles.content}>
            <div className={styles.list}>
              {items.map((item) => {
                const imageSrc = getProductMainImage(item.product);
                return (
                  <article key={item.product.id} className={styles.item}>
                    <div className={styles.imageWrap}>
                      {imageSrc ? (
                        <SmartImage src={imageSrc} alt={item.product.title} sizePreset="card" />
                      ) : (
                        <div aria-hidden="true" className={styles.imageFallback}>Нет фото</div>
                      )}
                    </div>

                    <div className={styles.info}>
                      <h3>{item.product.title}</h3>
                      <p className={styles.stock}>Осталось {item.product.stock ?? 1} шт</p>
                      <p className={styles.delivery}>• 24 – 27 апр, курьером 149₽</p>
                      <p className={styles.price}>{formatPrice(item.product.price)}</p>
                    </div>

                    <div className={styles.rightControls}>
                      <div className={styles.iconRow}>
                        <button type="button" aria-label="В избранное" className={styles.iconBtn}>♡</button>
                        <button className={styles.iconBtn} onClick={() => removeItem(item.product.id)}>
                          ✕
                        </button>
                      </div>

                      <div className={styles.qtyRow}>
                        <button onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))} aria-label="Уменьшить количество">−</button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateQuantity(item.product.id, Math.max(1, Number(event.target.value) || 1))}
                        />
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} aria-label="Увеличить количество">+</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <aside className={styles.summary}>
              <button className={styles.cta} onClick={handleCheckout}>
                Перейти к оформлению
              </button>

              <label className={styles.promo}>
                <input type="text" placeholder="Промокод" />
              </label>

              <div className={styles.totals}>
                <p><span>{items.length} товар</span><strong>{formatPrice(subtotal)}</strong></p>
                <p><span>Выгода</span><strong>−{formatPrice(discount)}</strong></p>
                <p><span>Доставка и сервисы</span><strong>{formatPrice(delivery)}</strong></p>
                <p className={styles.grandTotal}><span>Итого</span><strong>{formatPrice(total)}</strong></p>
              </div>

              <div className={styles.installments}>
                <strong>12×{Math.max(1, Math.round(total / 12))}₽</strong>
                <span>12 месяцев, без переплат</span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
};
