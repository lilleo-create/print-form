import type { ProductCardDto } from '../api/favoritesApi';
import { FavoriteCard } from './FavoriteCard';
import styles from './FavoritesGrid.module.css';

type FavoritesGridProps = {
  items: ProductCardDto[];
};

export const FavoritesGrid = ({ items }: FavoritesGridProps) => {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <FavoriteCard key={item.id} item={item} />
      ))}
    </div>
  );
};
