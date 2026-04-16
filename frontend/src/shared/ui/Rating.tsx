import styles from './Rating.module.css';

interface RatingProps {
  value?: number;
  count?: number;
  size?: 'sm' | 'md';
  hideCount?: boolean;
  neutralLabel?: string;
}

export const Rating = ({ value = 0, count = 0, size = 'sm', hideCount = false, neutralLabel }: RatingProps) => {
  const stars = Array.from({ length: 5 }, (_, index) => index + 1);
  const roundedValue = Math.max(0, Math.min(5, Number(value) || 0));
  const showNeutral = Boolean(neutralLabel) && count <= 0;

  return (
    <div className={styles.wrapper} data-size={size} aria-label={showNeutral ? neutralLabel : `Рейтинг ${roundedValue.toFixed(1)} из 5`}>
      <div className={showNeutral ? `${styles.stars} ${styles.starsNeutral}` : styles.stars}>
        {stars.map((star) => (
          <span key={star} className={star <= Math.round(roundedValue) ? styles.starActive : styles.star}>
            ★
          </span>
        ))}
      </div>
      {showNeutral ? <span className={styles.count}>{neutralLabel}</span> : <>
        <span className={styles.value}>{roundedValue.toFixed(1)}</span>
        {!hideCount ? <span className={styles.count}>({count})</span> : null}
      </>}
    </div>
  );
};
