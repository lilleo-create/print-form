import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Product, Review } from '../shared/types';
import { Rating } from '../shared/ui/Rating';
import { Button } from '../shared/ui/Button';
import { useCartStore } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import { ProductCard } from '../widgets/shop/ProductCard';
import styles from './ProductPage.module.css';

const formatDeliveryDate = (date?: string) => {
  if (date) return date;
  const next = new Date();
  next.setDate(next.getDate() + 3);
  return next.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
};

export const ProductPage = () => {
  const { id } = useParams();
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [feedProducts, setFeedProducts] = useState<Product[]>([]);
  const [feedPage, setFeedPage] = useState(1);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getProduct(id)
      .then((response) => {
        setProduct(response.data);
        setActiveImage(response.data.images?.[0]?.url ?? response.data.image);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.getProductReviews(id, 1, 5).then((response) => {
      setReviews(response.data);
      setReviewsPage(1);
      setHasMoreReviews(response.data.length >= 5);
    });
  }, [id]);

  const loadMoreReviews = useCallback(async () => {
    if (!id || !hasMoreReviews) return;
    const nextPage = reviewsPage + 1;
    const response = await api.getProductReviews(id, nextPage, 5);
    setReviews((prev) => [...prev, ...response.data]);
    setReviewsPage(nextPage);
    setHasMoreReviews(response.data.length >= 5);
  }, [hasMoreReviews, id, reviewsPage]);

  const loadFeed = useCallback(async () => {
    if (feedLoading || !feedHasMore) return;
    setFeedLoading(true);
    const response = await api.getProducts({ page: feedPage, limit: 6, sort: 'createdAt', order: 'desc' });
    setFeedProducts((prev) => {
      const ids = new Set(prev.map((item) => item.id));
      const nextItems = response.data.filter((item) => !ids.has(item.id));
      return [...prev, ...nextItems];
    });
    setFeedHasMore(response.data.length > 0);
    setFeedPage((prev) => prev + 1);
    setFeedLoading(false);
  }, [feedHasMore, feedLoading, feedPage]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!sentinelRef.current || !feedHasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadFeed();
          }
        });
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [feedHasMore, loadFeed]);

  const specs = useMemo(() => {
    if (!product) return [];
    return (
      product.specs ?? [
        { id: 'material', key: 'Материал', value: product.material, sortOrder: 1 },
        { id: 'size', key: 'Размер', value: product.size, sortOrder: 2 },
        { id: 'technology', key: 'Технология', value: product.technology, sortOrder: 3 },
        { id: 'printTime', key: 'Время печати', value: product.printTime, sortOrder: 4 },
        { id: 'color', key: 'Цвет', value: product.color, sortOrder: 5 }
      ]
    ).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [product]);

  const handleReviewSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !user) return;
    setSubmitting(true);
    try {
      const response = await api.createReview(id, { rating, text: reviewText });
      setReviews((prev) => [response.data, ...prev]);
      setReviewText('');
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              ratingCount: (prev.ratingCount ?? 0) + 1,
              ratingAvg: ((prev.ratingAvg ?? 0) * (prev.ratingCount ?? 0) + rating) / ((prev.ratingCount ?? 0) + 1)
            }
          : prev
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !product) {
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
        <div className={styles.hero}>
          <div className={styles.gallery}>
            <img src={activeImage} alt={product.title} className={styles.mainImage} />
            <div className={styles.thumbs}>
              {(product.images?.length ? product.images : [{ id: 'main', url: product.image, sortOrder: 0 }]).map(
                (image) => (
                  <button
                    key={image.id}
                    className={
                      activeImage === image.url ? `${styles.thumb} ${styles.thumbActive}` : styles.thumb
                    }
                    onClick={() => setActiveImage(image.url)}
                    aria-label={`Показать изображение ${product.title}`}
                  >
                    <img src={image.url} alt={product.title} />
                  </button>
                )
              )}
            </div>
          </div>
          <div className={styles.details}>
            <div className={styles.header}>
              <h1>{product.title}</h1>
              <Rating value={product.ratingAvg} count={product.ratingCount} size="md" />
            </div>
            <div className={styles.priceBlock}>
              <span className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</span>
              <span className={styles.delivery}>Ближайшая доставка: {formatDeliveryDate(product.deliveryDateNearest)}</span>
            </div>
            <div className={styles.sku}>Артикул: {product.sku ?? '—'}</div>
            {product.variants && product.variants.length > 0 ? (
              <label className={styles.variant}>
                Варианты
                <select value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)}>
                  <option value="">Выберите вариант</option>
                  {product.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button
              onClick={() => {
                addItem(product, 1);
              }}
            >
              Добавить в корзину
            </Button>
            <p className={styles.shortDescription}>{product.descriptionShort ?? product.description}</p>
          </div>
        </div>
        <div className={styles.sections}>
          <div className={styles.specs}>
            <h2>Характеристики</h2>
            <ul>
              {specs.map((spec) => (
                <li key={spec.id}>
                  <span>{spec.key}</span>
                  <strong>{spec.value}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.reviews}>
            <div className={styles.reviewsHeader}>
              <h2>Отзывы</h2>
              <Rating value={product.ratingAvg} count={product.ratingCount} />
            </div>
            {user ? (
              <form className={styles.reviewForm} onSubmit={handleReviewSubmit}>
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
                  Отзыв
                  <textarea
                    value={reviewText}
                    minLength={10}
                    maxLength={1000}
                    required
                    onChange={(event) => setReviewText(event.target.value)}
                  />
                </label>
                <Button type="submit" disabled={isSubmitting}>
                  Отправить
                </Button>
              </form>
            ) : (
              <p className={styles.reviewHint}>Войдите, чтобы оставить отзыв.</p>
            )}
            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <article key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <strong>{review.user?.name ?? 'Покупатель'}</strong>
                    <Rating value={review.rating} count={0} />
                  </div>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
            {hasMoreReviews && (
              <Button variant="secondary" onClick={loadMoreReviews}>
                Показать еще
              </Button>
            )}
          </div>
        </div>
        <div className={styles.feed}>
          <h2>Ещё товары</h2>
          <div className={styles.feedGrid}>
            {feedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
          {feedLoading && <p className={styles.loading}>Загрузка...</p>}
          <div ref={sentinelRef} />
        </div>
      </div>
    </section>
  );
};
