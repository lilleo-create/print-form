import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Card } from '../shared/ui/Card';
import { Tabs } from '../shared/ui/Tabs';
import { ProductCard } from '../widgets/shop/ProductCard';
import { CustomPrintForm } from '../widgets/shop/CustomPrintForm';
import { CatalogBoot } from '../features/catalog/CatalogBoot';
import styles from './LandingPage.module.css';

export const LandingPage = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const catalogBootFilters = useMemo(
    () => ({
      category: activeCategory === 'all' ? '' : activeCategory,
      sort: 'rating' as const,
      order: 'desc' as const,
      limit: 8
    }),
    [activeCategory]
  );

  return (
    <CatalogBoot filters={catalogBootFilters}>
      {({ filterData, products, loading, error }) => {
        const categories = filterData.categories.length
          ? filterData.categories
          : Array.from(new Set(products.map((product) => product.category))).filter(Boolean);
        const categoryOptions = [
          { label: 'Все категории', value: 'all' },
          ...categories.slice(0, 6).map((category) => ({ label: category, value: category }))
        ];
        const visibleProducts = products.slice(0, 8);

        return (
          <div className={styles.page}>
            <section className={`${styles.hero} container`}>
              <div className={styles.heroContent}>
                <span className={styles.eyebrow}>Сервис 3D-печати и маркетплейс</span>
                <h1>3D-печать и готовые модели — в одном сервисе</h1>
                <p>Купите готовую модель или загрузите свою — мы напечатаем и доставим.</p>
                <div className={styles.heroActions}>
                  <Link to="/catalog" className={styles.primaryCta}>
                    Найти готовую модель
                  </Link>
                  <a href="#upload" className={styles.secondaryCta}>
                    Напечатать свою модель
                  </a>
                </div>
              </div>
              <Card className={styles.heroPanel}>
                <h3>Два сценария в одном сервисе</h3>
                <ul className={styles.heroList}>
                  <li>Маркетплейс готовых 3D-моделей с печатью и доставкой.</li>
                  <li>Печать по файлу: STL, STEP, OBJ с подбором материала.</li>
                </ul>
                <div className={styles.heroHint}>Выберите нужный сценарий и начните заказ.</div>
              </Card>
            </section>

            <section className={`${styles.catalogSection} container`} id="catalog">
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Быстрый каталог</h2>
                  <p>Реальные модели от продавцов маркетплейса.</p>
                </div>
                <Link to="/catalog" className={styles.sectionLink}>
                  Перейти в каталог →
                </Link>
              </div>
              <div className={styles.catalogTabs}>
                <Tabs options={categoryOptions} value={activeCategory} onChange={setActiveCategory} />
              </div>
              {loading ? (
                <p className={styles.feedLoading}>Загружаем каталог...</p>
              ) : error ? (
                <p className={styles.feedLoading}>Не удалось загрузить каталог.</p>
              ) : (
                <div className={styles.grid}>
                  {visibleProducts.map((product) => (
                    <ProductCard product={product} key={product.id} />
                  ))}
                </div>
              )}
            </section>

            <section className={`${styles.uploadSection} container`} id="upload">
              <div className={styles.uploadContent}>
                <h2>Есть своя 3D-модель?</h2>
                <p>Загрузите STL, STEP или OBJ — мы подберём материал, рассчитаем цену и напечатаем.</p>
                <div className={styles.uploadCard}>
                  <label htmlFor="model-upload" className={styles.uploadDrop}>
                    <span className={styles.uploadTitle}>Перетащите файл модели</span>
                    <span className={styles.uploadHint}>или выберите на компьютере</span>
                    <span className={styles.uploadFormats}>STL · STEP · OBJ</span>
                  </label>
                  <input
                    id="model-upload"
                    className={styles.uploadInput}
                    type="file"
                    accept=".stl,.step,.stp,.obj"
                    multiple
                  />
                  <div className={styles.uploadActions}>
                    <label htmlFor="model-upload" className={styles.primaryCtaSmall}>
                      Загрузить файл
                    </label>
                    <Link to="/catalog" className={styles.secondaryCtaSmall}>
                      Посмотреть готовые модели
                    </Link>
                  </div>
                </div>
              </div>
              <CustomPrintForm />
            </section>

            <section className={`${styles.stepsSection} container`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Как работает сервис</h2>
                  <p>Три шага без лишних слов.</p>
                </div>
              </div>
              <div className={styles.stepsGrid}>
                <Card className={styles.stepCard}>
                  <span>01</span>
                  <h4>Выбираете модель или загружаете свою</h4>
                  <p>Каталог готовых моделей и загрузка файлов в одном месте.</p>
                </Card>
                <Card className={styles.stepCard}>
                  <span>02</span>
                  <h4>Мы печатаем на проверенных производствах</h4>
                  <p>Подбираем материал и технологию, согласуем сроки.</p>
                </Card>
                <Card className={styles.stepCard}>
                  <span>03</span>
                  <h4>Получаете готовое изделие</h4>
                  <p>Доставка по городу или самовывоз из пункта.</p>
                </Card>
              </div>
            </section>

            <section className={`${styles.audienceSection} container`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Для кого этот сервис</h2>
                  <p>Сценарии, в которых сервис особенно полезен.</p>
                </div>
              </div>
              <div className={styles.audienceGrid}>
                <Card className={styles.audienceCard}>
                  <h4>Инженеры</h4>
                  <p>Прототипы, детали и тестовые сборки.</p>
                </Card>
                <Card className={styles.audienceCard}>
                  <h4>Дизайнеры</h4>
                  <p>Формы, макеты и визуальные образцы.</p>
                </Card>
                <Card className={styles.audienceCard}>
                  <h4>Бизнес</h4>
                  <p>Малые серии, изделия для клиентов и выставок.</p>
                </Card>
                <Card className={styles.audienceCard}>
                  <h4>Подарки и хобби</h4>
                  <p>Фигурки, модели и уникальные изделия.</p>
                </Card>
              </div>
            </section>

            <section className={`${styles.trustSection} container`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Доверие и цифры</h2>
                  <p>Конкретные показатели сервиса.</p>
                </div>
              </div>
              <div className={styles.trustGrid}>
                <Card className={styles.trustCard}>
                  <strong>4.9</strong>
                  <span>средний рейтинг сервиса</span>
                </Card>
                <Card className={styles.trustCard}>
                  <strong>120+</strong>
                  <span>производств и продавцов</span>
                </Card>
                <Card className={styles.trustCard}>
                  <strong>2–5 дней</strong>
                  <span>средний срок печати</span>
                </Card>
                <Card className={styles.trustCard}>
                  <strong>18 000+</strong>
                  <span>выполненных заказов</span>
                </Card>
              </div>
            </section>

            <section className={`${styles.finalSection} container`}>
              <Card className={styles.finalCard}>
                <div>
                  <h2>Начните с удобного сценария</h2>
                  <p>Перейдите в каталог или загрузите свою 3D-модель прямо сейчас.</p>
                </div>
                <div className={styles.finalActions}>
                  <Link to="/catalog" className={styles.primaryCta}>
                    Перейти в каталог
                  </Link>
                  <a href="#upload" className={styles.secondaryCta}>
                    Загрузить свою модель
                  </a>
                </div>
              </Card>
            </section>
          </div>
        );
      }}
    </CatalogBoot>
  );
};
