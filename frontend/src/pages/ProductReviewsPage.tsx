import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Product, Review } from '../shared/types';
import { Rating } from '../shared/ui/Rating';
import { Button } from '../shared/ui/Button';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import { useProductBoardStore } from '../app/store/productBoardStore';
import styles from './ProductReviewsPage.module.css';

const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

const filterLabels = {
  helpful: 'Полезные',
  high: 'С высокой оценкой',
  low: 'С низкой оценкой',
  new: 'Новые'
} as const;

type ReviewFilter = keyof typeof filterLabels;

type ReviewScope = 'all' | 'variant';

export const ProductReviewsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
  const setProductBoard = useProductBoardStore((state) => state.setProduct);
  const [product, setProduct] = useState<Product | null>(null);
  const [summary, setSummary] = useState<{ total: number; avg: number; counts: { rating: number; count: number }[]; photos: string[] } | null>(
    null
  );
  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('new');
  const [scope, setScope] = useState<ReviewScope>('all');
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getProduct(id).then((response) => setProduct(response.data));
  }, [id]);

  useEffect(() => {
    if (product) {
      setProductBoard(product);
    }
  }, [product, setProductBoard]);

  useEffect(() => () => setProductBoard(null), [setProductBoard]);

  const scopedProductIds = useMemo(() => {
    if (!product) return [];
    const variantIds =
      product.variants?.map((variant) => variant.productId).filter(Boolean) as string[] | undefined;
    return Array.from(new Set([product.id, ...(variantIds ?? [])]));
  }, [product]);

  const reviewProductIds = scope === 'all' ? scopedProductIds : undefined;

  const loadSummary = async () => {
    if (!id) return;
    const response = await api.getReviewSummary(id, reviewProductIds);
    setSummary(response.data.data);
  };

  const loadReviews = async (nextPage = 1) => {
    if (!id) return;
    setLoading(true);
    const response = await api.getProductReviews(id, nextPage, 6, filter, reviewProductIds);
    setReviews((prev) => (nextPage === 1 ? response.data.data : [...prev, ...response.data.data]));
    setHasMore(response.data.data.length === 6);
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    loadReviews(1);
    loadSummary();
    setPage(1);
  }, [filter, id, scope, scopedProductIds]);

  const distribution = useMemo(() => summary?.counts ?? [], [summary]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !user) return;
    setSubmitting(true);
    try {
      const photoList = photos
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      await api.createReview(id, {
        rating,
        pros,
        cons,
        comment,
        photos: photoList.length ? photoList : undefined
      });
      await loadReviews(1);
      setPage(1);
      await loadSummary();
      const updated = await api.getProduct(id);
      setProduct(updated.data);
      setPros('');
      setCons('');
      setComment('');
      setPhotos('');
      setRating(5);
    } finally {
      setSubmitting(false);
    }
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

  const total = summary?.total ?? 0;

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(`/product/${product.id}`)}>
            ← Назад к товару
          </button>
          <div>
            <h1>{product.title}</h1>
            <p className={styles.subtitle}>Отзывы покупателей</p>
          </div>
        </div>

        <div className={styles.content}>
          <aside className={styles.sidebar}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{summary?.avg?.toFixed(1) ?? '0.0'}</span>
              <Rating value={summary?.avg ?? 0} count={total} size="md" />
              <ul>
                {distribution.map((item) => (
                  <li key={item.rating}>
                    <span>{item.rating}★</span>
                    <div className={styles.bar}>
                      <div
                        className={styles.barFill}
                        style={{ width: total ? `${(item.count / total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span>{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.purchaseCard}>
              <div className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</div>
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

          <div className={styles.main}>
            <div className={styles.toggleRow}>
              <div className={styles.scopes}>
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
                >
                  Этот вариант
                </button>
              </div>
              <div className={styles.filters}>
                {(Object.keys(filterLabels) as ReviewFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={filter === key ? styles.filterActive : styles.filterButton}
                    onClick={() => setFilter(key)}
                  >
                    {filterLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.mediaStrip}>
              {(summary?.photos ?? []).length === 0 ? (
                <p className={styles.empty}>Фото из отзывов пока нет.</p>
              ) : (
                <div className={styles.mediaRow}>
                  {(summary?.photos ?? []).map((photo) => (
                    <button
                      type="button"
                      className={styles.mediaItem}
                      key={photo}
                      onClick={() => setActivePhoto(photo)}
                    >
                      <img src={photo} alt="Фото из отзыва" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user && (
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
                  <input value={pros} onChange={(event) => setPros(event.target.value)} required />
                </label>
                <label>
                  Недостатки
                  <input value={cons} onChange={(event) => setCons(event.target.value)} required />
                </label>
                <label>
                  Комментарий
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} required />
                </label>
                <label>
                  Фото (ссылки через запятую)
                  <input value={photos} onChange={(event) => setPhotos(event.target.value)} />
                </label>
                <Button type="submit" disabled={submitting}>
                  Отправить
                </Button>
              </form>
            )}

            <div className={styles.reviewList}>
              {reviews.length === 0 ? (
                <p className={styles.empty}>Пока нет отзывов.</p>
              ) : (
                reviews.map((review) => (
                  <article key={review.id} className={styles.reviewCard}>
                    <div className={styles.reviewTop}>
                      <div>
                        <strong>{review.user?.name ?? 'Имя скрыто'}</strong>
                        <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                      </div>
                      <Rating value={review.rating} count={0} />
                    </div>
                    <div className={styles.reviewBody}>
                      <p>
                        <strong>Достоинства:</strong> {review.pros}
                      </p>
                      <p>
                        <strong>Недостатки:</strong> {review.cons}
                      </p>
                      <p>
                        <strong>Комментарий:</strong> {review.comment}
                      </p>
                    </div>
                    {review.photos && review.photos.length > 0 && (
                      <div className={styles.reviewPhotos}>
                        {review.photos.map((photo) => (
                          <button
                            type="button"
                            key={photo}
                            className={styles.mediaItem}
                            onClick={() => setActivePhoto(photo)}
                          >
                            <img src={photo} alt="Фото отзыва" />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={styles.reviewActions}>
                      <button type="button">Ответить</button>
                      <div className={styles.reaction}>
                        <span>👍 {review.likesCount ?? 0}</span>
                        <span>👎 {review.dislikesCount ?? 0}</span>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            {hasMore && (
              <Button
                variant="secondary"
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  loadReviews(nextPage);
                }}
                disabled={loading}
              >
                Загрузить ещё
              </Button>
            )}
          </div>
        </div>
      </div>

      {activePhoto && (
        <div className={styles.modal} onClick={() => setActivePhoto(null)}>
          <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.modalClose} onClick={() => setActivePhoto(null)}>
              ✕
            </button>
            <img src={activePhoto} alt="Фото отзыва" />
          </div>
        </div>
      )}
    </section>
  );
};
