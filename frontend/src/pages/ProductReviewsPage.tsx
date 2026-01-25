import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Review, Product } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { Rating } from '../shared/ui/Rating';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import styles from './ProductReviewsPage.module.css';

const sortOptions = [
  { id: 'helpful', label: 'Полезные', value: 'helpful' },
  { id: 'rating_desc', label: 'С высокой оценкой', value: 'rating_desc' },
  { id: 'rating_asc', label: 'С низкой оценкой', value: 'rating_asc' },
  { id: 'new', label: 'Новые', value: 'new' }
] as const;

type SortValue = (typeof sortOptions)[number]['value'];

export const ProductReviewsPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{
    avg: number;
    total: number;
    distribution: Record<string, number>;
  }>({
    avg: 0,
    total: 0,
    distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'all' | 'variant'>('all');
  const [sort, setSort] = useState<SortValue>('new');
  const [rating, setRating] = useState(5);
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [comment, setComment] = useState('');
  const [photosInput, setPhotosInput] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const variantProductId = searchParams.get('variantProductId');
  const productIdsAll = useMemo(() => {
    if (!id) return [] as string[];
    if (variantProductId && variantProductId !== id) {
      return [id, variantProductId];
    }
    return [id];
  }, [id, variantProductId]);

  const activeProductIds = scope === 'variant' && variantProductId ? [variantProductId] : productIdsAll;

  const mediaPhotos = useMemo(() => reviews.flatMap((review) => review.photos ?? []), [reviews]);

  useEffect(() => {
    if (!id) return;
    api.getProduct(id).then((response) => setProduct(response.data));
  }, [id]);

  const loadSummary = async () => {
    if (!id) return;
    const response = await api.getProductReviewsSummary(id, activeProductIds);
    setSummary(response.data);
  };

  const loadReviews = async (pageToLoad: number, reset = false) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.getProductReviews(id, {
        page: pageToLoad,
        limit: 6,
        sort,
        productIds: activeProductIds
      });
      setReviews((prev) => (reset ? response.data : [...prev, ...response.data]));
      setHasMore(response.data.length >= 6);
      setPage(pageToLoad);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить отзывы.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setReviews([]);
    setPage(1);
    setHasMore(true);
    if (id) {
      loadReviews(1, true);
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sort, scope, variantProductId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !user) return;
    const photos = photosInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    await api.createReview(id, { rating, pros, cons, comment, photos: photos.length ? photos : undefined });
    setPros('');
    setCons('');
    setComment('');
    setPhotosInput('');
    await loadReviews(1, true);
    await loadSummary();
    const refreshed = await api.getProduct(id);
    setProduct(refreshed.data);
  };

  if (!product) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p>Загрузка...</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <button className={styles.back} type="button" onClick={() => navigate(`/product/${product.id}`)}>
            ← Назад к товару
          </button>
          <div>
            <h1>Отзывы и оценки</h1>
            <p>{product.title}</p>
          </div>
        </div>

        <div className={styles.layout}>
          <aside className={styles.summary}>
            <div className={styles.summaryCard}>
              <Rating value={summary.avg} count={summary.total} size="md" />
              <div className={styles.summaryStats}>
                <span>{summary.total} отзывов</span>
              </div>
              <div className={styles.ratingBars}>
                {[5, 4, 3, 2, 1].map((value) => (
                  <div key={value} className={styles.ratingRow}>
                    <span>{value}★</span>
                    <div className={styles.ratingTrack}>
                      <div
                        className={styles.ratingFill}
                        style={{
                          width: summary.total
                            ? `${((summary.distribution[String(value)] ?? 0) / summary.total) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <span>{summary.distribution[String(value)] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className={styles.content}>
            <div className={styles.controls}>
              <div className={styles.toggle}>
                <button
                  type="button"
                  className={scope === 'all' ? styles.toggleActive : styles.toggleButton}
                  onClick={() => setScope('all')}
                >
                  Все отзывы
                </button>
                <button
                  type="button"
                  className={scope === 'variant' ? styles.toggleActive : styles.toggleButton}
                  onClick={() => setScope('variant')}
                  disabled={!variantProductId}
                >
                  Этот вариант
                </button>
              </div>
              <div className={styles.filters}>
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={sort === option.value ? styles.filterActive : styles.filterButton}
                    onClick={() => setSort(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {mediaPhotos.length > 0 && (
              <div className={styles.mediaStrip}>
                {mediaPhotos.map((url, index) => (
                  <button key={`${url}-${index}`} type="button" onClick={() => setSelectedPhoto(url)}>
                    <img src={url} alt="Фото из отзывов" />
                  </button>
                ))}
              </div>
            )}

            {user ? (
              <form className={styles.reviewForm} onSubmit={handleSubmit}>
                <h3>Оставить отзыв</h3>
                <label>
                  Оценка
                  <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option value={value} key={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Достоинства
                  <textarea value={pros} onChange={(event) => setPros(event.target.value)} required />
                </label>
                <label>
                  Недостатки
                  <textarea value={cons} onChange={(event) => setCons(event.target.value)} required />
                </label>
                <label>
                  Комментарий
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} required />
                </label>
                <label>
                  Фото (URL через запятую)
                  <input
                    value={photosInput}
                    onChange={(event) => setPhotosInput(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <Button type="submit">Отправить</Button>
              </form>
            ) : (
              <p className={styles.authHint}>Войдите, чтобы оставить отзыв.</p>
            )}

            <div className={styles.list}>
              {reviews.map((review) => (
                <article key={review.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{review.user?.name ?? 'Имя скрыто'}</strong>
                      <div className={styles.cardMeta}>
                        <Rating value={review.rating} count={0} />
                        <span>{new Date(review.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <button type="button">Ответить</button>
                      <div>
                        <span>👍 {review.likesCount ?? 0}</span>
                        <span>👎 {review.dislikesCount ?? 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.block}>
                    <span>Достоинства:</span>
                    <p>{review.pros || '—'}</p>
                  </div>
                  <div className={styles.block}>
                    <span>Недостатки:</span>
                    <p>{review.cons || '—'}</p>
                  </div>
                  <div className={styles.block}>
                    <span>Комментарий:</span>
                    <p>{review.comment || '—'}</p>
                  </div>
                  {review.photos && review.photos.length > 0 && (
                    <div className={styles.cardPhotos}>
                      {review.photos.map((photo) => (
                        <img key={photo} src={photo} alt="Фото отзыва" />
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {reviews.length === 0 && !loading && <p className={styles.empty}>Отзывов пока нет.</p>}
              {error && <p className={styles.error}>{error}</p>}
            </div>

            {hasMore && (
              <Button variant="secondary" onClick={() => loadReviews(page + 1)} disabled={loading}>
                Показать ещё
              </Button>
            )}
          </div>

          <aside className={styles.purchase}>
            <div className={styles.purchaseCard}>
              <span className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</span>
              <Button
                onClick={() => {
                  addItem(product, 1);
                  navigate('/checkout');
                }}
              >
                Купить сейчас
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  addItem(product, 1);
                }}
              >
                В корзину
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {selectedPhoto && (
        <div className={styles.modal} role="dialog" aria-modal="true" onClick={() => setSelectedPhoto(null)}>
          <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
            <img src={selectedPhoto} alt="Фото отзыва" />
            <button type="button" onClick={() => setSelectedPhoto(null)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
