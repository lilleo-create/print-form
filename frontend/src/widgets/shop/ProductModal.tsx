import { useEffect, useState } from 'react';
import { useCartStore } from '../../app/store/cartStore';
import { useUiStore } from '../../app/store/uiStore';
import { Button } from '../../shared/ui/Button';
import styles from './ProductModal.module.css';

export const ProductModal = () => {
  const product = useUiStore((state) => state.selectedProduct);
  const close = useUiStore((state) => state.closeProduct);
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
  }, [product]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    if (product) {
      window.addEventListener('keydown', handleKey);
    }

    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [product, close]);

  if (!product) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <button className={styles.close} onClick={close} aria-label="Закрыть модальное окно">
          ✕
        </button>
        <div className={styles.content}>
          <img src={product.image} alt={product.title} className={styles.image} />
          <div className={styles.details}>
            <h2>{product.title}</h2>
            <p className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</p>
            <p>{product.description}</p>
            <ul className={styles.specs}>
              <li>
                <span>Материал</span>
                <strong>{product.material}</strong>
              </li>
              <li>
                <span>Размер</span>
                <strong>{product.size}</strong>
              </li>
              <li>
                <span>Технология</span>
                <strong>{product.technology}</strong>
              </li>
              <li>
                <span>Время печати</span>
                <strong>{product.printTime}</strong>
              </li>
              <li>
                <span>Цвет</span>
                <strong>{product.color}</strong>
              </li>
            </ul>
            <div className={styles.actions}>
              <label className={styles.quantity}>
                Количество
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>
              <div className={styles.buttons}>
                <Button
                  onClick={() => {
                    addItem(product, quantity);
                    close();
                  }}
                >
                  Добавить в корзину
                </Button>
                <Button variant="secondary">Заказать в другом размере</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
