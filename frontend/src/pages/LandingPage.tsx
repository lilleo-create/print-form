import { Link } from 'react-router-dom';
import { useCatalog } from '../features/catalog/useCatalog';
import { ProductCard } from '../widgets/shop/ProductCard';
import { Button } from '../shared/ui/Button';
import { CustomPrintForm } from '../widgets/shop/CustomPrintForm';
import styles from './LandingPage.module.css';

export const LandingPage = () => {
  const { products } = useCatalog({});

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
        <div className={styles.grid}>
          {products.slice(0, 4).map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>
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
