import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../shared/ui/Button';
import { CustomPrintForm } from '../widgets/shop/CustomPrintForm';
import styles from './LandingPage.module.css';

export const LandingPage = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  // Guard против параллельных запросов (state в замыканиях не спасает)
  const loadingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const slides = useMemo(
    () => [
      {
        title: 'Скидки на быстрые прототипы',
        description: 'Готовые решения для инженеров и дизайнеров со скидкой до 20%.',
        cta: 'Смотреть предложения',
        image:
          'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Популярные заказы недели',
        description: 'Топ-модели по оценкам клиентов и скорости доставки.',
        cta: 'В каталог',
        image:
          'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Промо для новых покупателей',
        description: 'Первый заказ с бесплатной доставкой по городу.',
        cta: 'Получить промо',
        image:
          'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=80'
      }
    ],
    []
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} container`}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>Маркетплейс 3D-печати</span>
          <h1>Покупайте и печатайте 3D-модели в одном месте</h1>
          <p>Каталог готовых изделий, быстрый расчет кастомной печати и надежные продавцы.</p>
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

      <section className={`${styles.sliderSection} container`}>
        <div className={styles.slider}>
          <div className={styles.sliderContent}>
            <span className={styles.sliderBadge}>Промо</span>
            <h2>{slides[activeSlide].title}</h2>
            <p>{slides[activeSlide].description}</p>
            <div className={styles.sliderActions}>
              <Link to="/catalog" className={styles.primaryLink}>
                {slides[activeSlide].cta}
              </Link>
              <button
                type="button"
                className={styles.secondaryLink}
                onClick={() => setActiveSlide((prev) => (prev + 1) % slides.length)}
              >
                Следующий баннер
              </button>
            </div>
          </div>
          <div className={styles.sliderMedia}>
            <img src={slides[activeSlide].image} alt={slides[activeSlide].title} />
          </div>
        </div>

        <div className={styles.sliderDots}>
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              className={index === activeSlide ? styles.dotActive : styles.dot}
              onClick={() => setActiveSlide(index)}
              aria-label={`Показать слайд ${index + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="container" id="catalog">
        <div className={styles.sectionHeader}>
          <div>
            <h2>Популярные модели</h2>
            <p>Лучшие продукты от продавцов маркетплейса.</p>
          </div>
          <Link to="/catalog" className={styles.link}>
            Весь каталог →
          </Link>
        </div>
        <div className={styles.grid} />
      </section>

      <section className={`${styles.customSection} container`} id="custom">
        <div className={styles.customContent}>
          <h2>Напечатать свою модель</h2>
          <p>Загрузите STL или опишите задачу — мы подберем технологию, материал и цену.</p>
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
