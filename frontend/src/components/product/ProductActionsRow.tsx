import styles from './ProductActionsRow.module.css';

interface ProductActionsRowProps {
  isFavorite: boolean;
  isLoading: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
}

export const ProductActionsRow = ({
  isFavorite,
  isLoading,
  onToggleFavorite,
  onShare
}: ProductActionsRowProps) => {
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${styles.actionButton} ${isFavorite ? styles.favoriteActive : ''}`}
        onClick={onToggleFavorite}
        disabled={isLoading}
      >
        <span aria-hidden>{isFavorite ? '♥' : '♡'}</span>
        <span>В избранное</span>
      </button>
      <button type="button" className={styles.actionButton} onClick={onShare}>
        <span aria-hidden>↗</span>
        <span>Поделиться</span>
      </button>
    </div>
  );
};
