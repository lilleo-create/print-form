import styles from './ProductActionsInline.module.css';

type ProductActionsInlineProps = {
  isFavorite: boolean;
  onFavoriteClick: () => void;
  onShareClick: () => void;
};

export const ProductActionsInline = ({ isFavorite, onFavoriteClick, onShareClick }: ProductActionsInlineProps) => {
  return (
    <div className={styles.actionsInline}>
      <button type="button" className={styles.actionLink} onClick={onFavoriteClick}>
        {isFavorite ? '♥ В избранном' : '♡ В избранное'}
      </button>
      <button type="button" className={styles.actionLink} onClick={onShareClick}>
        ↗ Поделиться
      </button>
    </div>
  );
};
