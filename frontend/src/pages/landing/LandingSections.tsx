import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { ProductCard } from '../../widgets/shop/ProductCard';
import { Product } from '../../shared/types';
import styles from '../LandingPage.module.css';

const CATEGORY_CHIPS = ['Фигурки', 'Декор', 'Запчасти', 'Прототипы', 'Подарки'];

type CatalogSectionProps = {
  products: Product[];
  loading: boolean;
  error: string | null;
  activeCategory: string;
  onCategoryChange: (value: string) => void;
};

export const HeroSection = () => (
  <section className={`${styles.hero} container`}>
    <div className={styles.heroContent}>
      <h1>3D-печать и готовые модели — в одном сервисе</h1>
      <p>
        Купите готовую 3D-модель или загрузите свою — мы напечатаем и доставим
      </p>
      <div className={styles.heroActions}>
        <Link to="/catalog" className={styles.ctaButton}>
          Найти готовую модель
        </Link>
        <a href="#custom" className={styles.ctaButton}>
          Напечатать свою модель
        </a>
      </div>
      <div className={styles.heroHint}>
        Без переписок с типографиями · Проверенные производства · Прозрачные
        цены
      </div>
    </div>
  </section>
);

export const CatalogSection = ({
  products,
  loading,
  error,
  activeCategory,
  onCategoryChange
}: CatalogSectionProps) => (
  <section className={`${styles.catalogSection} container`}>
    <div className={styles.sectionHeader}>
      <h2>Популярные категории</h2>
    </div>
    <div className={styles.categoryChips}>
      {CATEGORY_CHIPS.map((category) => (
        <Button
          key={category}
          size="sm"
          variant={activeCategory === category ? 'primary' : 'secondary'}
          onClick={() => onCategoryChange(category)}
        >
          {category}
        </Button>
      ))}
    </div>
    {loading ? (
      <p className={styles.feedLoading}>Загружаем каталог...</p>
    ) : error ? (
      <p className={styles.feedLoading}>Не удалось загрузить каталог.</p>
    ) : (
      <div className={styles.grid}>
        {products.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
    )}
  </section>
);

export const UploadSection = () => (
  <section className={`${styles.uploadSection} container`} id="custom">
    <div className={styles.uploadContent}>
      <h2>Есть своя 3D-модель?</h2>
      <p>
        Функция временно отключена. Скоро здесь снова можно будет загрузить файл
        на печать.
      </p>
      <div className={`${styles.uploadCard} ${styles.uploadCardDisabled}`}>
        <div
          className={`${styles.uploadDrop} ${styles.uploadDropDisabled}`}
          aria-disabled="true"
        >
          <span className={styles.uploadTitle}>Появится в будущем</span>
          <span className={styles.uploadHint}>
            Загрузка STL / STEP / OBJ временно недоступна
          </span>
          <span className={styles.uploadFormats}>
            Следите за обновлениями Print-Form
          </span>
        </div>
      </div>
    </div>
  </section>
);

export const StepsSection = () => (
  <section className={`${styles.stepsSection} container`}>
    <div className={styles.sectionHeader}>
      <h2>Как работает сервис</h2>
    </div>
    <div className={styles.stepsGrid}>
      <Card className={styles.stepCard}>
        <span className={styles.stepIcon}>🧩</span>
        <p>Выбираете модель или загружаете свою</p>
      </Card>
      <Card className={styles.stepCard}>
        <span className={styles.stepIcon}>🏭</span>
        <p>Мы печатаем на проверенных производствах</p>
      </Card>
      <Card className={styles.stepCard}>
        <span className={styles.stepIcon}>📦</span>
        <p>Получаете готовое изделие</p>
      </Card>
    </div>
  </section>
);

export const AudienceSection = () => (
  <section className={`${styles.audienceSection} container`}>
    <div className={styles.sectionHeader}>
      <h2>Кому подойдёт</h2>
    </div>
    <div className={styles.audienceGrid}>
      <Card className={styles.audienceCard}>
        <h3>Инженерам</h3>
        <p>прототипы, детали</p>
      </Card>
      <Card className={styles.audienceCard}>
        <h3>Дизайнерам</h3>
        <p>формы, макеты</p>
      </Card>
      <Card className={styles.audienceCard}>
        <h3>Бизнесу</h3>
        <p>мелкие серии</p>
      </Card>
      <Card className={styles.audienceCard}>
        <h3>Для подарков</h3>
        <p>уникальные вещи</p>
      </Card>
    </div>
  </section>
);

export const TrustSection = () => (
  <section className={`${styles.trustSection} container`}>
    <div className={styles.sectionHeader}>
      <h2>Нам доверяют</h2>
    </div>
    <div className={styles.trustGrid}>
      <Card className={styles.trustCard}>
        <span className={styles.trustIcon}>⭐</span>
        <strong>4.9</strong>
        <p>средняя оценка</p>
      </Card>
      <Card className={styles.trustCard}>
        <span className={styles.trustIcon}>🏭</span>
        <strong>120+</strong>
        <p>производств</p>
      </Card>
      <Card className={styles.trustCard}>
        <span className={styles.trustIcon}>📦</span>
        <strong>24/7</strong>
        <p>заказы</p>
      </Card>
      <Card className={styles.trustCard}>
        <span className={styles.trustIcon}>⏱</span>
        <strong>от 48 часов</strong>
        <p>на печать</p>
      </Card>
    </div>
  </section>
);

export const FinalCtaSection = () => (
  <section className={`${styles.finalSection} container`}>
    <Card className={styles.finalCard}>
      <h2>Готовы начать?</h2>
      <div className={styles.finalActions}>
        <Link to="/catalog" className={styles.ctaButton}>
          Найти модель
        </Link>
        <a href="#custom" className={styles.ctaButton}>
          Загрузить свою
        </a>
      </div>
    </Card>
  </section>
);
