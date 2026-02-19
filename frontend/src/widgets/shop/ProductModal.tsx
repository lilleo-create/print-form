import { useEffect, useRef, useState } from 'react';
import { useCartStore } from '../../app/store/cartStore';
import { useUiStore } from '../../app/store/uiStore';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import styles from './ProductModal.module.css';

export const ProductModal = () => {
  const product = useUiStore((state) => state.selectedProduct);
  const close = useUiStore((state) => state.closeProduct);
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuantity(1);
  }, [product]);

  useModalFocus(Boolean(product), close, modalRef);

  if (!product) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={close}>
      <div className={styles.modal} ref={modalRef} onClick={(event) => event.stopPropagation()}>
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
                <span>Изготовление</span>
                <strong>{product.productionTimeHours ?? 24} часов</strong>
              </li>
              <li>
                <span>Цвет</span>
                <strong>{product.color}</strong>
              </li>
              {product.dxCm && product.dyCm && product.dzCm ? (
                <li>
                  <span>Габариты</span>
                  <strong>{product.dxCm}×{product.dyCm}×{product.dzCm} см{product.weightGrossG ? `, ${product.weightGrossG} г` : ''}</strong>
                </li>
              ) : null}
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
                  onClick={(event) => {
                    event.stopPropagation();
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
