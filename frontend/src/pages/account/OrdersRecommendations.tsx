import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import type { Product } from '../../shared/types';
import { ProductCard } from '../../widgets/shop/ProductCard';
import styles from './OrdersRecommendations.module.css';

export const OrdersRecommendations = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;
    void api.getProducts({ sort: 'createdAt', order: 'desc', limit: 6 })
      .then(({ data }) => { if (active) setProducts(data.slice(0, 6)); })
      .catch(() => { if (active) setProducts([]); });
    return () => { active = false; };
  }, []);

  if (!products.length) return null;
  return <section className={styles.section} aria-label="Может заинтересовать">
    <h2>Может заинтересовать</h2>
    <div className={styles.row}>{products.map(product => <ProductCard key={product.id} product={product} />)}</div>
  </section>;
};
