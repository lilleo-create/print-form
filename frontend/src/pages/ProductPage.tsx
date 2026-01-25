import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Product, ProductVariant, Review } from '../shared/types';
import { Rating } from '../shared/ui/Rating';
import { Button } from '../shared/ui/Button';
import { useCartStore } from '../app/store/cartStore';
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
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [selectedVariantProductId, setSelectedVariantProductId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsSummary, setReviewsSummary] = useState({
    avg: 0,
    total: 0,
    distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
  });
  const [feedProducts, setFeedProducts] = useState<Product[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedError, setFeedError] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getProduct(id)
      .then((response) => {
        setProduct(response.data);
        setActiveImage(response.data.images?.[0]?.url ?? response.data.image);
        setSelectedVariant('');
        setSelectedVariantProductId(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.getProductReviews(id, { limit: 3, sort: 'new' }).then((response) => {
      setReviews(response.data);
    });
    api.getProductReviewsSummary(id).then((response) => {
      setReviewsSummary(response.data);
    });
  }, [id]);

  const loadFeed = useCallback(async () => {
    if (feedLoading || !feedHasMore) return;
    setFeedLoading(true);
    setFeedError('');
    try {
      const response = await api.getProducts({
        cursor: feedCursor ?? undefined,
        limit: 6,
        sort: 'createdAt',
        order: 'desc'
      });
      setFeedProducts((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const nextItems = response.data.filter((item) => item.id !== id && !ids.has(item.id));
        return [...prev, ...nextItems];
      });
      setFeedHasMore(response.data.length > 0);
      setFeedCursor(response.data.at(-1)?.id ?? null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Не удалось загрузить товары.');
      setFeedHasMore(false);
    } finally {
      setFeedLoading(false);
    }
  }, [feedCursor, feedHasMore, feedLoading, id]);

  useEffect(() => {
    setFeedProducts([]);
    setFeedCursor(null);
    setFeedHasMore(true);
    setFeedError('');
  }, [id]);

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

  const resolveVariantProductId = (variant?: ProductVariant | null) => {
    if (!variant) return null;
    return variant.productId ?? variant.linkedProductId ?? variant.options?.productId?.[0] ?? null;
  };
  const reviewsBaseId = id ?? '';
  const reviewsLink = selectedVariantProductId
    ? `/product/${reviewsBaseId}/reviews?variantProductId=${selectedVariantProductId}`
    : `/product/${reviewsBaseId}/reviews`;

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
              <button
                type="button"
                className={styles.ratingLink}
                onClick={() => navigate(reviewsLink)}
              >
                <Rating value={product.ratingAvg} count={product.ratingCount} size="md" />
                <span className={styles.ratingMeta}>
                  {product.ratingCount ?? 0} оценки · {reviewsSummary.total} отзывов
                </span>
              </button>
            </div>
            <div className={styles.priceBlock}>
              <span className={styles.price}>{product.price.toLocaleString('ru-RU')} ₽</span>
              <span className={styles.delivery}>
                Ближайшая дата доставки: {formatDeliveryDate(product.deliveryDateNearest)}
              </span>
            </div>
            <div className={styles.sku}>Артикул: {product.sku ?? '—'}</div>
            {product.variants && product.variants.length > 0 ? (
              <label className={styles.variant}>
                Варианты
                <select
                  value={selectedVariant}
                  onChange={(event) => {
                    const nextVariantId = event.target.value;
                    setSelectedVariant(nextVariantId);
                    const variant = product.variants?.find((item) => item.id === nextVariantId);
                    const nextProductId = resolveVariantProductId(variant);
                    setSelectedVariantProductId(nextProductId);
                    if (nextProductId && nextProductId !== id) {
                      navigate(`/product/${nextProductId}`);
                    }
                  }}
                >
                  <option value="">Выберите вариант</option>
                  {product.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className={styles.actions}>
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
              <Button variant="ghost" onClick={() => {}}>
                В избранное
              </Button>
            </div>
            <p className={styles.shortDescription}>{product.descriptionShort ?? product.description}</p>
          </div>
        </div>
        <div className={styles.sections}>
          <div className={styles.description}>
            <h2>Описание</h2>
            <p>{product.descriptionFull ?? product.description}</p>
          </div>
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
          <div className={styles.reviewsPreview}>
            <div className={styles.reviewsHeader}>
              <h2>Отзывы</h2>
              <Link className={styles.reviewsLink} to={reviewsLink}>
                Все отзывы →
              </Link>
            </div>
            <div className={styles.ratingSummary}>
              <Rating value={reviewsSummary.avg} count={reviewsSummary.total} />
              <div className={styles.ratingBars}>
                {[5, 4, 3, 2, 1].map((value) => (
                  <div key={value} className={styles.ratingRow}>
                    <span>{value}★</span>
                    <div className={styles.ratingTrack}>
                      <div
                        className={styles.ratingFill}
                        style={{
                          width: reviewsSummary.total
                            ? `${((reviewsSummary.distribution[String(value)] ?? 0) / reviewsSummary.total) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <span>{reviewsSummary.distribution[String(value)] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.reviewList}>
              {reviews.slice(0, 3).map((review) => (
                <article key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <strong>{review.user?.name ?? 'Имя скрыто'}</strong>
                    <Rating value={review.rating} count={0} />
                  </div>
                  <div className={styles.reviewBlock}>
                    <span>Достоинства:</span>
                    <p>{review.pros || review.comment}</p>
                  </div>
                  <div className={styles.reviewBlock}>
                    <span>Недостатки:</span>
                    <p>{review.cons || '—'}</p>
                  </div>
                  <div className={styles.reviewBlock}>
                    <span>Комментарий:</span>
                    <p>{review.comment || '—'}</p>
                  </div>
                </article>
              ))}
              {reviews.length === 0 && <p className={styles.reviewHint}>Отзывов пока нет.</p>}
            </div>
          </div>
        </div>
        <div className={styles.feed}>
          <h2>Ещё товары</h2>
          <div className={styles.feedGrid}>
            {feedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
          {feedError && <p className={styles.loading}>{feedError}</p>}
          {feedLoading && <p className={styles.loading}>Загрузка...</p>}
          <div ref={sentinelRef} />
        </div>
      </div>
    </section>
  );
};
