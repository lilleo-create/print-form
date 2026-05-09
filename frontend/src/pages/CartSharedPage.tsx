import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../shared/api';
import { useCartStore } from '../app/store/cartStore';
import { ProductCard } from '../widgets/shop/ProductCard';
import { Skeleton } from '../shared/ui/Skeleton';
import type { Product } from '../shared/types';
import styles from './CartSharedPage.module.css';

export const CartSharedPage = () => {
  const [searchParams] = useSearchParams();
  const addItem = useCartStore((state) => state.addItem);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [added, setAdded] = useState(false);

  const rawIds = searchParams.get('items') ?? '';
  const ids = rawIds.split(',').filter(Boolean);

  useEffect(() => {
    if (ids.length === 0) { setIsLoading(false); return; }

    setIsLoading(true);
    Promise.allSettled(ids.map((id) => api.getProduct(id)))
      .then((results) => {
        const fetched = results
          .filter((r): r is PromiseFulfilledResult<{ data: Product }> => r.status === 'fulfilled')
          .map((r) => r.value.data)
          .filter(Boolean);
        setProducts(fetched);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawIds]);

  const handleAddAll = () => {
    products.forEach((p) => addItem(p, 1));
    setAdded(true);
  };

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
          <h1 className={styles.title}>Поделились корзиной</h1>
          <p className={styles.subtitle}>
            {isLoading ? 'Загружаем товары…' : `${products.length} товар${products.length !== 1 ? 'а' : ''}`}
          </p>
        </header>

        {!isLoading && products.length > 0 && (
          <button
            type="button"
            className={`${styles.addAllBtn} ${added ? styles.addAllBtnDone : ''}`}
            onClick={handleAddAll}
            disabled={added}
          >
            {added ? '✓ Добавлено в вашу корзину' : 'Добавить всё в корзину'}
          </button>
        )}

        <div className={styles.grid}>
          {isLoading
            ? Array.from({ length: ids.length || 4 }).map((_, i) => (
                <Skeleton key={i} className={styles.skeleton} />
              ))
            : products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
          }
        </div>

        {!isLoading && products.length === 0 && (
          <div className={styles.empty}>
            <p>Товары не найдены или ссылка устарела</p>
            <Link to="/catalog" className={styles.emptyLink}>Перейти в каталог</Link>
          </div>
        )}
      </div>
    </section>
  );
};
