import { useMemo } from 'react';
import type { Product, ProductSpec } from '../../shared/types';
import styles from '../../pages/ProductPage.module.css';

type ProductSpecsProps = {
  product: Product;
};

export const ProductSpecs = ({ product }: ProductSpecsProps) => {
  const specs = useMemo<ProductSpec[]>(() => {
    const fallback = product.specs ?? [
      { id: 'material', key: 'Материал', value: (product as any).material, sortOrder: 1 },
      { id: 'size', key: 'Размер', value: (product as any).size, sortOrder: 2 },
      { id: 'technology', key: 'Технология', value: (product as any).technology, sortOrder: 3 },
      { id: 'printTime', key: 'Время печати', value: (product as any).printTime, sortOrder: 4 },
      { id: 'color', key: 'Цвет', value: (product as any).color, sortOrder: 5 }
    ];

    return [...fallback].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [product]);

  return (
    <div className={styles.sections}>
      <div className={styles.description}>
        <h2>Описание</h2>
        <p>{product.descriptionFull ?? product.description}</p>
      </div>

      <div className={styles.specs}>
        <h2>Характеристики</h2>
        <ul>
          {specs.map((spec) => (
            <li key={spec.id}>
              <span>{spec.key}</span>
              <strong>{spec.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
