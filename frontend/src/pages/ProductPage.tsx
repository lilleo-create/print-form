import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Product, ProductSpec, ProductVariant, Review } from '../shared/types';
import { Rating } from '../shared/ui/Rating';
import { Button } from '../shared/ui/Button';
import { useCartStore } from '../app/store/cartStore';
import { useProductBoardStore } from '../app/store/productBoardStore';
import { ProductCard } from '../widgets/shop/ProductCard';
import styles from './ProductPage.module.css';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

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

type ReviewSummary = {
  total: number;
  avg: number;
  counts: { rating: number; count: number }[];
  photos?: string[];
};

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
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  const [feedProducts, setFeedProducts] = useState<Product[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const feedControllerRef = useRef<AbortController | null>(null);
  const feedLoadingRef = useRef(false); // защита от спама observer

  const resolveImageUrl = useCallback((url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return `${apiBaseUrl}${url}`;
    return `${apiBaseUrl}/${url}`;
  }, []);

  const extractData = useCallback(<T,>(value: unknown): T => {
    if (value && typeof value === 'object' && 'data' in value) {
      return (value as { data: T }).data;
    }
    return value as T;
  }, []);

  // ===== Product
  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();
    let isActive = true;

    setLoading(true);
    setError(null);

    api
      .getProduct(id, { signal: controller.signal })
      .then((response) => {
        if (!isActive) return;
        const productData = extractData<Product | null>(response);
        setProduct(productData ?? null);
        setActiveImage(resolveImageUrl(productData?.images?.[0]?.url ?? (productData as any)?.image));
      })
      .catch((err) => {
        if (!isActive) return;
        if (err instanceof Error && err.name === 'AbortError') return;

        const status = (err as { status?: number })?.status;
        if (status === 429) {
          setError('Слишком много запросов. Пожалуйста, попробуйте позже.');
          return;
        }
        if (status === 404) {
          setProduct(null);
          return;
        }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить товар.');
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [extractData, id, resolveImageUrl]);

  // Sync product to store
  useEffect(() => {
    if (product) setProductBoard(product);
  }, [product, setProductBoard]);

  // cleanup store
  useEffect(() => () => setProductBoard(null), [setProductBoard]);

  // ===== Reviews + Summary
  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();
    let isActive = true;

    api
      .getProductReviews(id, 1, 3, 'new', undefined, { signal: controller.signal })
      .then((response) => {
        if (!isActive) return;
        const raw = extractData<{ data?: Review[] } | Review[]>(response);
        setReviews(Array.isArray(raw) ? raw : raw?.data ?? []);
      })
      .catch((err) => {
        if (!isActive) return;
        if (err instanceof Error && err.name === 'AbortError') return;

        const status = (err as { status?: number })?.status;
        if (status === 429) setError('Слишком много запросов. Пожалуйста, попробуйте позже.');
        setReviews([]);
      });

    api
      .getReviewSummary(id, undefined, { signal: controller.signal })
      .then((response) => {
        if (!isActive) return;
        const raw = extractData<ReviewSummary | { data?: ReviewSummary } | null>(response);
        const value =
          raw && typeof raw === 'object' && 'data' in raw
            ? ((raw as { data?: ReviewSummary }).data ?? null)
            : (raw as ReviewSummary | null);
        setSummary(value);
      })
      .catch((err) => {
        if (!isActive) return;
        if (err instanceof Error && err.name === 'AbortError') return;

        const status = (err as { status?: number })?.status;
        if (status === 429) setError('Слишком много запросов. Пожалуйста, попробуйте позже.');
        setSummary(null);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [extractData, id]);

  // ===== Feed (ещё товары)
  const setFeedLoadingSafe = (v: boolean) => {
    feedLoadingRef.current = v;
    setFeedLoading(v);
  };

  const loadFeed = useCallback(async () => {
    if (!id) return;
    if (feedLoadingRef.current || !feedHasMore) return;

    setFeedLoadingSafe(true);

    feedControllerRef.current?.abort();
    const controller = new AbortController();
    feedControllerRef.current = controller;

    try {
      const response = await api.getProducts(
        { cursor: feedCursor ?? undefined, limit: 6, sort: 'createdAt', order: 'desc' },
        { signal: controller.signal }
      );

      if (feedControllerRef.current !== controller) return;

      const raw = extractData<unknown>(response);
      const items: Product[] = Array.isArray(raw) ? (raw as Product[]) : ((raw as { data?: Product[] })?.data ?? []);

      setFeedProducts((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        const nextItems = items.filter((x) => x.id !== id && !ids.has(x.id));
        return [...prev, ...nextItems];
      });

      setFeedHasMore(items.length > 0);
      setFeedCursor(items.length ? items[items.length - 1]?.id ?? null : null);
    } catch (e: unknown) {
      if (feedControllerRef.current !== controller) return;
      if (e instanceof Error && e.name === 'AbortError') return;

      const status = (e as { status?: number })?.status;
      if (status === 429) {
        setError('Слишком много запросов. Пожалуйста, попробуйте позже.');
      }
      setFeedHasMore(false);
    } finally {
      if (feedControllerRef.current === controller) setFeedLoadingSafe(false);
    }
  }, [extractData, feedCursor, feedHasMore, id]);

  // reset feed on product change
  useEffect(() => {
    setFeedProducts([]);
    setFeedCursor(null);
    setFeedHasMore(true);
    feedControllerRef.current?.abort();
    feedLoadingRef.current = false;
    setFeedLoading(false);
  }, [id]);

  // initial feed load (один раз после reset)
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !feedHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (feedLoadingRef.current) return;
        loadFeed();
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [feedHasMore, loadFeed]);

  // cleanup abort
  useEffect(() => {
    return () => {
      feedControllerRef.current?.abort();
    };
  }, []);

  const specs = useMemo(() => {
    if (!product) return [];
    const fallback = product.specs ?? [
      { id: 'material', key: 'Материал', value: (product as any).material, sortOrder: 1 },
      { id: 'size', key: 'Размер', value: (product as any).size, sortOrder: 2 },
      { id: 'technology', key: 'Технология', value: (product as any).technology, sortOrder: 3 },
      { id: 'printTime', key: 'Время печати', value: (product as any).printTime, sortOrder: 4 },
      { id: 'color', key: 'Цвет', value: (product as any).color, sortOrder: 5 }
    ];

    return [...fallback].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [product]);

  const variants: ProductVariant[] = product?.variants ?? [];
  const safeReviews: Review[] = Array.isArray(reviews) ? reviews : [];

  const reviewsCount = summary?.total ?? 0;
  const ratingCount = product?.ratingCount ?? reviewsCount;

  const handleVariantChange = (variantId: string) => {
    setSelectedVariant(variantId);

    const variant = variants.find((v) => v.id === variantId) as any;
    const nextProductId = variant?.productId ?? variantId;

    if (product && nextProductId && nextProductId !== product.id) {
      navigate(`/product/${nextProductId}`);
    }
  };

  // ===== UI states
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
    product.images && product.images.length > 0
      ? product.images
      : [{ id: 'main', url: (product as any).image, sortOrder: 0 }];

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.gallery}>
            <img src={activeImage} alt={product.title} className={styles.mainImage} />
            <div className={styles.thumbs}>
              {productImages.map((image: any) => {
                const resolved = resolveImageUrl(image.url);
                return (
                  <button
                    key={image.id}
                    className={activeImage === resolved ? `${styles.thumb} ${styles.thumbActive}` : styles.thumb}
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
                <Rating value={product.ratingAvg ?? 0} count={ratingCount} size="md" />
                <Link to={`/product/${product.id}/reviews`} className={styles.reviewLink}>
                  {ratingCount} оценки · {reviewsCount} отзывов
                </Link>
              </div>
            </div>

            <div className={styles.priceBlock}>
              <span className={styles.price}>
                {Number((product as any).price ?? 0).toLocaleString('ru-RU')} ₽
              </span>
              <span className={styles.delivery}>
                Ближайшая дата доставки: {formatDeliveryDate(product.deliveryDateNearest)}
              </span>
            </div>

            <div className={styles.sku}>Артикул: {(product as any).sku ?? '—'}</div>

            {variants.length > 0 ? (
              <div className={styles.variantBlock}>
                <span>Варианты</span>
                <div className={styles.variantList}>
                  {variants.map((variant) => (
                    <button
                      type="button"
                      key={variant.id}
                      className={selectedVariant === variant.id ? styles.variantActive : styles.variantButton}
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

              <Button variant="secondary" onClick={() => addItem(product, 1)}>
                В корзину
              </Button>

              <Button variant="ghost" onClick={() => {}}>
                В избранное
              </Button>
            </div>

            <p className={styles.shortDescription}>{product.descriptionShort ?? (product as any).description}</p>
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
              {specs.map((spec: ProductSpec) => (
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
              <p className={styles.reviewsHint}>Последние впечатления покупателей</p>
            </div>
            <Link to={`/product/${product.id}/reviews`} className={styles.reviewLink}>
              Смотреть все отзывы
            </Link>
          </div>

          <div className={styles.reviewsContent}>
            <div className={styles.reviewsSummary}>
              <div className={styles.summaryTop}>
                <span className={styles.summaryValue}>
                  {typeof summary?.avg === 'number' ? summary.avg.toFixed(1) : '0.0'}
                </span>
                <Rating value={summary?.avg ?? 0} count={reviewsCount} />
              </div>

              <ul>
                {(summary?.counts ?? [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }))).map((item) => (
                  <li key={item.rating}>
                    <span>{item.rating}★</span>
                    <div className={styles.bar}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: reviewsCount ? `${(item.count / reviewsCount) * 100}%` : '0%'
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
                        <strong>{(review as any).user?.name ?? 'Имя скрыто'}</strong>
                        <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                      </div>
                      <Rating value={review.rating} count={0} />
                    </div>

                    <div className={styles.reviewBody}>
                      <p>
                        <strong>Достоинства:</strong> {(review as any).pros}
                      </p>
                      <p>
                        <strong>Недостатки:</strong> {(review as any).cons}
                      </p>
                      <p>
                        <strong>Комментарий:</strong> {(review as any).comment}
                      </p>
                    </div>

                    {(((review as any).photos?.length ?? 0) > 0) ? (
                      <div className={styles.reviewPhotos}>
                        {(review as any).photos!.map((photo: string, index: number) => (
                          <img src={resolveImageUrl(photo)} alt={`Фото отзыва ${index + 1}`} key={`${photo}-${index}`} />
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
