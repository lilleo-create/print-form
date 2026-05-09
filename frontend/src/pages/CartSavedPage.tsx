import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore, STALE_CART_MS } from '../app/store/cartStore';
import { ProductCard } from '../widgets/shop/ProductCard';
import styles from './CartSavedPage.module.css';

export const CartSavedPage = () => {
  const allItems = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);

  const now = Date.now();

  const staleItems = useMemo(
    () => allItems.filter((i) => i.addedAt && now - i.addedAt >= STALE_CART_MS),
    [allItems, now]
  );

  return (
    <section className={styles.page}>
      <div className={`container ${styles.container}`}>
        <nav className={styles.breadcrumb}>
          <Link to="/cart" className={styles.breadLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Корзина
          </Link>
        </nav>

        <header className={styles.header}>
          <h1 className={styles.title}>
            Давно в корзине
            {staleItems.length > 0 && (
              <span className={styles.count}>{staleItems.length}</span>
            )}
          </h1>
          {staleItems.length > 0 && (
            <button
              type="button"
              className={styles.clearAll}
              onClick={() => staleItems.forEach((i) => removeItem(i.product.id))}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
              Удалить всё
            </button>
          )}
        </header>

        {staleItems.length === 0 ? (
          <div className={styles.empty}>
            <p>Нет давно добавленных товаров</p>
            <Link to="/catalog" className={styles.emptyLink}>Перейти в каталог</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {staleItems.map(({ product }) => (
              <div key={product.id} className={styles.cardWrap}>
                <ProductCard product={product} />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeItem(product.id)}
                  aria-label="Убрать из корзины"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                  Убрать
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
