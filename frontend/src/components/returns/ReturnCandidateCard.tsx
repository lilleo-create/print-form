import { Button } from '../../shared/ui/Button';
import styles from './ReturnCandidateCard.module.css';

interface ReturnCandidateCardProps {
  title: string;
  price: number;
  image?: string;
  orderDate: string;
  isReturning: boolean;
  onCreate: () => void;
  onChat: () => void;
}

export const ReturnCandidateCard = ({
  title,
  price,
  image,
  orderDate,
  isReturning,
  onCreate,
  onChat
}: ReturnCandidateCardProps) => {
  return (
    <article className={styles.card}>
      {image && <img src={image} alt={title} className={styles.image} />}
      <div className={styles.body}>
        <p className={styles.caption}>
          Заказ от{' '}
          {new Date(orderDate).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })}
        </p>
        <h3>{title}</h3>
        <p className={styles.price}>{price.toLocaleString('ru-RU')} ₽</p>
        <div className={styles.actions}>
          {isReturning ? (
            <>
              <span className={styles.badge}>Заявка отправлена</span>
              <Button type="button" variant="secondary" onClick={onChat}>
                Перейти в чат
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onCreate}>
              Оформить возврат
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};
