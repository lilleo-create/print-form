import styles from './Rating.module.css';

interface RatingProps {
  value?: number;
  count?: number;
  size?: 'sm' | 'md';
}

export const Rating = ({ value = 0, count = 0, size = 'sm' }: RatingProps) => {
  const stars = Array.from({ length: 5 }, (_, index) => index + 1);
  return (
    <div className={styles.wrapper} data-size={size} aria-label={`Рейтинг ${value.toFixed(1)} из 5`}>
      <div className={styles.stars}>
        {stars.map((star) => (
          <span key={star} className={star <= Math.round(value) ? styles.starActive : styles.star}>
            ★
          </span>
        ))}
      </div>
      <span className={styles.value}>{value.toFixed(1)}</span>
      <span className={styles.count}>({count})</span>
    </div>
  );
};
