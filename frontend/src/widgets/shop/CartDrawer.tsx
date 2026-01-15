import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCartStore } from '../../app/store/cartStore';
import { useUiStore } from '../../app/store/uiStore';
import { api } from '../../shared/api';
import { Button } from '../../shared/ui/Button';
import styles from './CartDrawer.module.css';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().min(5, 'Введите телефон'),
  address: z.string().min(5, 'Введите адрес'),
  delivery: z.string().min(1, 'Выберите доставку')
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export const CartDrawer = () => {
  const { items, updateQuantity, removeItem, clear } = useCartStore();
  const { isCartOpen, closeCart } = useUiStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
    reset
  } = useForm<CheckoutFormValues>({ resolver: zodResolver(checkoutSchema) });

  useEffect(() => {
    if (isSubmitSuccessful) {
      reset();
      clear();
    }
  }, [isSubmitSuccessful, reset, clear]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCart();
      }
    };

    if (isCartOpen) {
      window.addEventListener('keydown', handleKey);
    }

    return () => window.removeEventListener('keydown', handleKey);
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) {
    return null;
  }

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const onSubmit = async () => {
    await api.createOrder({
      total,
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity
      }))
    });
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h3>Корзина</h3>
          <button className={styles.close} onClick={closeCart} aria-label="Закрыть корзину">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {items.length === 0 ? (
            <p className={styles.empty}>Корзина пуста. Добавьте товар из каталога.</p>
          ) : (
            <div className={styles.items}>
              {items.map((item) => (
                <div className={styles.item} key={item.product.id}>
                  <img src={item.product.image} alt={item.product.title} />
                  <div className={styles.itemInfo}>
                    <h4>{item.product.title}</h4>
                    <p>{item.product.price.toLocaleString('ru-RU')} ₽</p>
                    <div className={styles.controls}>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) =>
                          updateQuantity(item.product.id, Number(event.target.value))
                        }
                        aria-label="Количество товара"
                      />
                      <button onClick={() => removeItem(item.product.id)}>Удалить</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <div className={styles.total}>
            <span>Итого</span>
            <strong>{total.toLocaleString('ru-RU')} ₽</strong>
          </div>
          <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
            <input placeholder="Имя" {...register('name')} />
            {errors.name && <span>{errors.name.message}</span>}
            <input placeholder="Телефон" {...register('phone')} />
            {errors.phone && <span>{errors.phone.message}</span>}
            <input placeholder="Адрес" {...register('address')} />
            {errors.address && <span>{errors.address.message}</span>}
            <select {...register('delivery')}>
              <option value="">Выберите доставку</option>
              <option value="courier">Курьер</option>
              <option value="pickup">Самовывоз</option>
            </select>
            {errors.delivery && <span>{errors.delivery.message}</span>}
            <Button type="submit">Оформить заказ</Button>
            {isSubmitSuccessful && <p className={styles.success}>Заказ отправлен!</p>}
          </form>
        </div>
      </div>
    </div>
  );
};
