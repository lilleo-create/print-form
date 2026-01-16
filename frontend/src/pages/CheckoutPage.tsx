import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../app/store/cartStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import styles from './CheckoutPage.module.css';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  contact: z.string().min(5, 'Введите телефон или email'),
  address: z.string().min(5, 'Введите адрес')
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export const CheckoutPage = () => {
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const createOrder = useOrdersStore((state) => state.createOrder);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CheckoutFormValues>({ resolver: zodResolver(checkoutSchema) });

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const onSubmit = async () => {
    if (!user || items.length === 0) {
      return;
    }
    const orderItems = items.map((item) => ({
      productId: item.product.id,
      name: item.product.title,
      price: item.product.price,
      qty: item.quantity
    }));
    await createOrder({ user, items: orderItems, total });
    clear();
    navigate('/account');
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Оформление заказа</h1>
          <p>Заполните контактные данные и подтвердите заказ.</p>
        </div>
        <div className={styles.content}>
          <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
            <label>
              Имя
              <input {...register('name')} />
              {errors.name && <span>{errors.name.message}</span>}
            </label>
            <label>
              Телефон или email
              <input {...register('contact')} />
              {errors.contact && <span>{errors.contact.message}</span>}
            </label>
            <label>
              Адрес доставки
              <input {...register('address')} />
              {errors.address && <span>{errors.address.message}</span>}
            </label>
            <button type="submit">Подтвердить заказ</button>
          </form>
          <aside className={styles.summary}>
            <h3>Ваш заказ</h3>
            <ul>
              {items.map((item) => (
                <li key={item.product.id}>
                  {item.product.title} × {item.quantity}
                  <span>{(item.product.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
                </li>
              ))}
            </ul>
            <div className={styles.total}>
              <span>Итого</span>
              <strong>{total.toLocaleString('ru-RU')} ₽</strong>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
