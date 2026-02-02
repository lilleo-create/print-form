import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Product, Review } from '../shared/types';
import { Rating } from '../shared/ui/Rating';
import { Button } from '../shared/ui/Button';
import { useCartStore } from '../app/store/cartStore';
import { useProductBoardStore } from '../app/store/productBoardStore';
import { ProductCard } from '../widgets/shop/ProductCard';
import styles from './ProductPage.module.css';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';


const formatDeliveryDate = (date?: string) => {
  if (date) return date;
  const next = new Date();
  next.setDate(next.getDate() + 3);
  return next.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
};

const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

export const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const setProductBoard = useProductBoardStore((state) => state.setProduct);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    avg: number;
    counts: { rating: number; count: number }[];
  } | null>(null);

  const [feedProducts, setFeedProducts] = useState<Product[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);


  // Derived safe arrays (NO HOOKS, safe even if product is null)
  const images = product?.images ?? [];
  const variants = product?.variants ?? [];
  const safeReviews = reviews ?? [];
  const reviewsCount = summary?.total ?? 0;
  const ratingCount = product?.ratingCount ?? summary?.total ?? 0;

  // IMPORTANT: useMemo must be called on every render (before any early return)
  const specs = useMemo(() => {
    if (!product) return [];

    const base = product.specs ?? [
      {
        id: 'material',
        key: 'Материал',
        value: (product as any).material,
        sortOrder: 1
      },
      { id: 'size', key: 'Размер', value: (product as any).size, sortOrder: 2 },
      {
        id: 'technology',
        key: 'Технология',
        value: (product as any).technology,
        sortOrder: 3
      },
      {
        id: 'printTime',
        key: 'Время печати',
        value: (product as any).printTime,
        sortOrder: 4
      },
      { id: 'color', key: 'Цвет', value: (product as any).color, sortOrder: 5 }
    ];

    return [...base].sort(
      (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
  }, [product]);

  // Load product
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    api
      .getProduct(id)
      .then((response: any) => {
        // Accept both: axios response OR already-unwrapped object
        const raw = response?.data ?? response;
        const productData = raw?.data ?? raw;

        setProduct(productData ?? null);

        const first = productData?.images?.[0]?.url ?? productData?.image ?? '';
        setActiveImage(resolveImageUrl(first));
      })
      .catch((err: any) => {
        setProduct(null);
        setError(
          err instanceof Error ? err.message : 'Не удалось загрузить товар.'
        );
      })
      .finally(() => setLoading(false));
  }, [id, resolveImageUrl]);

  // Sync product to store
  useEffect(() => {
    if (product) setProductBoard(product);
  }, [product, setProductBoard]);

  // cleanup store
  useEffect(() => () => setProductBoard(null), [setProductBoard]);

  // Load reviews + summary
  useEffect(() => {
    if (!id) return;

    api
      .getProductReviews(id, 1, 3, 'new')
      .then((response: any) => {
        const raw = response?.data ?? response;
        setReviews(raw?.data ?? raw ?? []);
      })
      .catch(() => setReviews([]));

    api
      .getReviewSummary(id)
      .then((response: any) => {
        const raw = response?.data ?? response;
        setSummary(raw?.data ?? raw ?? null);
      })
      .catch(() => setSummary(null));
  }, [id]);

  const loadFeed = useCallback(async () => {
    if (feedLoading || !feedHasMore) return;

    setFeedLoading(true);
    try {
      const response: any = await api.getProducts({
        cursor: feedCursor ?? undefined,
        limit: 6,
        sort: 'createdAt',
        order: 'desc'
      });

      const raw = response?.data ?? response;
      const items: Product[] = Array.isArray(raw)
        ? raw
        : (raw?.data ?? raw ?? []);

      setFeedProducts((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const nextItems = items.filter(
          (item) => item.id !== id && !ids.has(item.id)
        );
        return [...prev, ...nextItems];
      });

      setFeedHasMore(items.length > 0);

      if (items.length > 0) {
        const last = items[items.length - 1];
        setFeedCursor(last?.id ?? null);
      } else {
        setFeedCursor(null);
      }
    } catch (e: any) {
      // важно: чтобы не было бесконечной долбёжки при 429/500/сетевых ошибках
      if (e?.status === 429) {
        setFeedHasMore(false);
        return;
      }

      // на любое другое тоже стопаем, иначе будет "вечный пулемёт" запросов
      setFeedHasMore(false);
    } finally {
      setFeedLoading(false);
    }
  }, [feedCursor, feedHasMore, feedLoading, id]);

  useEffect(() => {
    setFeedProducts([]);
    setFeedCursor(null);
    setFeedHasMore(true);
  }, [id]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!sentinelRef.current || !feedHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !feedLoading) loadFeed();
        });
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [feedHasMore, feedLoading, loadFeed]);

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p>Загрузка...</p>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p>{error ?? 'Товар не найден.'}</p>
        </div>
      </section>
    );
  }

  const productImages =
    images.length > 0
      ? images
      : ([{ id: 'main', url: (product as any).image, sortOrder: 0 }] as any[]);

  const handleVariantChange = (variantId: string) => {
    setSelectedVariant(variantId);
    const variant = variants.find((item: any) => item.id === variantId);
    const nextProductId = (variant as any)?.productId ?? variantId;

    if (nextProductId && nextProductId !== product.id) {
      navigate(`/product/${nextProductId}`);
    }
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.gallery}>
            <img
              src={activeImage}
              alt={product.title}
              className={styles.mainImage}
            />
            <div className={styles.thumbs}>
              {productImages.map((image: any) => {
                const resolved = resolveImageUrl(image.url);
                return (
                  <button
                    key={image.id}
                    className={
                      activeImage === resolved
                        ? `${styles.thumb} ${styles.thumbActive}`
                        : styles.thumb
                    }
                    onClick={() => setActiveImage(resolved)}
                    aria-label={`Показать изображение ${product.title}`}
                    type="button"
                  >
                    <img src={resolved} alt={product.title} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.details}>
            <div className={styles.header}>
              <h1>{product.title}</h1>
              <div className={styles.ratingRow}>
                <Rating
                  value={product.ratingAvg ?? 0}
                  count={ratingCount}
                  size="md"
                />
                <Link
                  to={`/product/${product.id}/reviews`}
                  className={styles.reviewLink}
                >
                  {ratingCount} оценки · {reviewsCount} отзывов
                </Link>
              </div>
            </div>

            <div className={styles.priceBlock}>
              <span className={styles.price}>
                {Number(product.price ?? 0).toLocaleString('ru-RU')} ₽
              </span>
              <span className={styles.delivery}>
                Ближайшая дата доставки:{' '}
                {formatDeliveryDate((product as any).deliveryDateNearest)}
              </span>
            </div>

            <div className={styles.sku}>Артикул: {product.sku ?? '—'}</div>

            {variants.length > 0 ? (
              <div className={styles.variantBlock}>
                <span>Варианты</span>
                <div className={styles.variantList}>
                  {variants.map((variant: any) => (
                    <button
                      type="button"
                      key={variant.id}
                      className={
                        selectedVariant === variant.id
                          ? styles.variantActive
                          : styles.variantButton
                      }
                      onClick={() => handleVariantChange(variant.id)}
                    >
                      {variant.name}
                    </button>
                  ))}
                </div>
              </div>
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

            <p className={styles.shortDescription}>
              {product.descriptionShort ?? (product as any).description}
            </p>
          </div>
        </div>

        <div className={styles.sections}>
          <div className={styles.description}>
            <h2>Описание</h2>
            <p>{product.descriptionFull ?? (product as any).description}</p>
          </div>

          <div className={styles.specs}>
            <h2>Характеристики</h2>
            <ul>
              {specs.map((spec: any) => (
                <li key={spec.id}>
                  <span>{spec.key}</span>
                  <strong>{spec.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.reviewsPreview}>
          <div className={styles.reviewsHeader}>
            <div>
              <h2>Отзывы</h2>
              <p className={styles.reviewsHint}>
                Последние впечатления покупателей
              </p>
            </div>
            <Link
              to={`/product/${product.id}/reviews`}
              className={styles.reviewLink}
            >
              Смотреть все отзывы
            </Link>
          </div>

          <div className={styles.reviewsContent}>
            <div className={styles.reviewsSummary}>
              <div className={styles.summaryTop}>
                <span className={styles.summaryValue}>
                  {summary?.avg?.toFixed(1) ?? '0.0'}
                </span>
                <Rating value={summary?.avg ?? 0} count={reviewsCount} />
              </div>

              <ul>
                {(
                  summary?.counts ??
                  [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }))
                ).map((item) => (
                  <li key={item.rating}>
                    <span>{item.rating}★</span>
                    <div className={styles.bar}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: reviewsCount
                            ? `${(item.count / reviewsCount) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <span>{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.reviewList}>
              {safeReviews.length === 0 ? (
                <p className={styles.reviewsEmpty}>Пока нет отзывов.</p>
              ) : (
                safeReviews.map((review) => (
                  <article key={review.id} className={styles.reviewCard}>
                    <div className={styles.reviewTop}>
                      <div>
                        <strong>{review.user?.name ?? 'Имя скрыто'}</strong>
                        <span className={styles.reviewDate}>
                          {formatReviewDate(review.createdAt)}
                        </span>
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

                    {(review.photos?.length ?? 0) > 0 ? (
                      <div className={styles.reviewPhotos}>
                        {review.photos!.map((photo, index) => (
                          <img
                            src={resolveImageUrl(photo)}
                            alt={`Фото отзыва ${index + 1}`}
                            key={photo}
                          />
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
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
          {feedLoading && <p className={styles.loading}>Загрузка...</p>}
          <div ref={sentinelRef} />
        </div>
      </div>
    </section>
  );
};
