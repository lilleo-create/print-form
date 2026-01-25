import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../shared/api';
import { Product } from '../shared/types';
import { ProductCard } from '../widgets/shop/ProductCard';
import { Button } from '../shared/ui/Button';
import { CustomPrintForm } from '../widgets/shop/CustomPrintForm';
import styles from './LandingPage.module.css';

export const LandingPage = () => {
  const [feedProducts, setFeedProducts] = useState<Product[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const sliderItems = useMemo(() => {
    const fromProducts = feedProducts.slice(0, 3).map((product) => ({
      id: product.id,
      title: product.title,
      description: product.descriptionShort ?? 'Популярный товар из каталога',
      image: product.image
    }));
    if (fromProducts.length >= 3) return fromProducts;
    return [
      { id: 'promo-1', title: 'Скидки на 3D-печать', description: 'Лучшие предложения недели', image: '' },
      { id: 'promo-2', title: 'Новые коллекции', description: 'Популярные модели для дома и офиса', image: '' },
      { id: 'promo-3', title: 'Экспресс-доставка', description: 'Доставим заказ за 1–3 дня', image: '' }
    ];
  }, [feedProducts]);

  useEffect(() => {
    if (activeSlide >= sliderItems.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, sliderItems.length]);

  const loadMore = useCallback(async () => {
    if (feedLoading || !feedHasMore) return;
    setFeedLoading(true);
    setFeedError('');
    try {
      const response = await api.getProducts({
        cursor: feedCursor ?? undefined,
        limit: 8,
        sort: 'createdAt',
        order: 'desc'
      });
      setFeedProducts((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const nextItems = response.data.filter((item) => !ids.has(item.id));
        return [...prev, ...nextItems];
      });
      setFeedHasMore(response.data.length > 0);
      const lastItem = response.data[response.data.length - 1];
      setFeedCursor(lastItem?.id ?? null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Не удалось загрузить товары.');
      setFeedHasMore(false);
    } finally {
      setFeedLoading(false);
    }
  }, [feedCursor, feedHasMore, feedLoading]);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    if (!sentinelRef.current || !feedHasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMore();
          }
        });
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [feedHasMore, loadMore]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>Маркетплейс 3D-печати</span>
          <h1>Покупайте и печатайте 3D-модели в одном месте</h1>
          <p>
            Каталог готовых изделий, быстрый расчет кастомной печати и надежные продавцы.
          </p>
          <div className={styles.heroActions}>
            <Link to="/catalog" className={styles.primaryLink}>
              Смотреть каталог
            </Link>
            <a href="#custom" className={styles.secondaryLink}>
              Напечатать свою модель
            </a>
          </div>
        </div>
        <div className={styles.heroCard}>
          <div>
            <h3>Сборка прототипа за 48 часов</h3>
            <p>Подберем материал, напечатаем и доставим до двери.</p>
          </div>
          <div className={styles.heroStats}>
            <div>
              <strong>120+</strong>
              <span>проверенных продавцов</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>поддержка заказов</span>
            </div>
            <div>
              <strong>4.9</strong>
              <span>рейтинг сервиса</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sliderSection}>
        <div className="container">
          <div className={styles.sliderHeader}>
            <h2>Акции и подборки</h2>
            <div className={styles.sliderActions}>
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => (prev === 0 ? sliderItems.length - 1 : prev - 1))}
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => (prev + 1) % sliderItems.length)}
              >
                →
              </button>
            </div>
          </div>
          <div className={styles.sliderTrack}>
            {sliderItems.map((item, index) => (
              <article
                key={item.id}
                className={styles.slide}
                style={{ transform: `translateX(${(index - activeSlide) * 100}%)` }}
              >
                {item.image ? <img src={item.image} alt={item.title} /> : <div className={styles.slideMock} />}
                <div className={styles.slideContent}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <Link to="/catalog" className={styles.slideLink}>
                    Перейти в каталог
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container" id="catalog">
        <div className={styles.sectionHeader}>
          <div>
            <h2>Лента товаров</h2>
            <p>Новые и популярные модели из каталога.</p>
          </div>
          <Link to="/catalog" className={styles.link}>
            Весь каталог →
          </Link>
        </div>
        <div className={styles.grid}>
          {feedProducts.map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>
        {feedError && <p className={styles.loading}>{feedError}</p>}
        {feedLoading && <p className={styles.loading}>Загрузка...</p>}
        <div ref={sentinelRef} />
      </section>

      <section className={styles.customSection} id="custom">
        <div className={styles.customContent}>
          <h2>Напечатать свою модель</h2>
          <p>
            Загрузите STL или опишите задачу — мы подберем технологию, материал и цену.
          </p>
          <div className={styles.customActions}>
            <Button>Загрузить STL</Button>
            <a className={styles.secondaryLink} href="https://t.me/" target="_blank" rel="noreferrer">
              Связаться в Telegram
            </a>
          </div>
        </div>
        <CustomPrintForm />
      </section>

      <section className={styles.benefits}>
        <div className="container">
          <h2>Почему выбирают нас</h2>
          <div className={styles.benefitGrid}>
            <div>
              <h4>Прозрачные сроки</h4>
              <p>Сразу показываем время печати и доставки.</p>
            </div>
            <div>
              <h4>Любой материал</h4>
              <p>PLA, ABS, PETG и смолы под любую задачу.</p>
            </div>
            <div>
              <h4>Контроль качества</h4>
              <p>Все продавцы проходят модерацию и рейтинг.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        <h2>Как это работает</h2>
        <div className={styles.steps}>
          <div>
            <span>01</span>
            <h4>Выберите модель</h4>
            <p>Подберите готовый товар или загрузите файл.</p>
          </div>
          <div>
            <span>02</span>
            <h4>Согласуйте параметры</h4>
            <p>Материал, цвет, размер и сроки.</p>
          </div>
          <div>
            <span>03</span>
            <h4>Получите заказ</h4>
            <p>Доставка курьером или самовывоз.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
