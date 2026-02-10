import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import { Button } from '../../../shared/ui/Button';
import { useCartStore } from '../../../app/store/cartStore';
import { useFavoritesStore } from '../model/useFavoritesStore';
import type { ProductCardDto } from '../api/favoritesApi';
import styles from './FavoriteCard.module.css';

type FavoriteCardProps = {
  item: ProductCardDto;
};

export const FavoriteCard = ({ item }: FavoriteCardProps) => {
  const navigate = useNavigate();
  const addToCart = useCartStore((state) => state.addItem);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  return (
    <article className={styles.card}>
      <button type="button" className={styles.mediaButton} onClick={() => navigate(`/product/${item.id}`)}>
        <img src={resolveImageUrl(item.image ?? '')} alt={item.title} className={styles.image} loading="lazy" />
      </button>

      <button
        type="button"
        className={styles.removeFavorite}
        onClick={() => {
          void toggleFavorite(item.id);
        }}
        aria-label="Удалить из избранного"
      >
        ♥
      </button>

      <button type="button" className={styles.title} onClick={() => navigate(`/product/${item.id}`)}>
        {item.title}
      </button>

      <div className={styles.price}>{item.price.toLocaleString('ru-RU')} ₽</div>

      {item.ratingAvg ? (
        <div className={styles.rating}>★ {item.ratingAvg.toFixed(1)} · {item.ratingCount ?? 0}</div>
      ) : null}

      {item.shortSpec ? <p className={styles.shortSpec}>{item.shortSpec}</p> : null}

      <Button
        size="sm"
        onClick={() =>
          addToCart(
            {
              id: item.id,
              title: item.title,
              category: 'Избранное',
              price: item.price,
              image: item.image ?? '',
              description: item.shortSpec ?? item.title,
              material: 'PLA',
              size: '—',
              technology: 'FDM',
              printTime: '—',
              color: '—',
              sellerId: null,
              ratingAvg: item.ratingAvg,
              ratingCount: item.ratingCount
            },
            1
          )
        }
      >
        В корзину
      </Button>
    </article>
  );
};
