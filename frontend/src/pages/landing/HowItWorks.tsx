import styles from './HowItWorks.module.css';

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <path d="M17 8l-5-5-5 5"/>
    <path d="M12 3v12"/>
  </svg>
);
const SlidersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/>
    <path d="M1 14h6M9 8h6M17 16h6"/>
  </svg>
);
const LayersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 3l9 5-9 5-9-5 9-5z"/>
    <path d="M3 13l9 5 9-5"/>
  </svg>
);
const TruckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="1" y="6" width="14" height="11"/>
    <path d="M15 9h5l3 4v4h-8"/>
    <circle cx="6" cy="19" r="2"/>
    <circle cx="18" cy="19" r="2"/>
  </svg>
);

const STEPS = [
  { n: '01', title: 'Выберите или загрузите', desc: 'Готовая модель из каталога или ваш файл — STL, OBJ, STEP.', icon: <UploadIcon /> },
  { n: '02', title: 'Настройте параметры', desc: 'Материал, цвет, заполнение, качество. Цена пересчитывается мгновенно.', icon: <SlidersIcon /> },
  { n: '03', title: 'Производство', desc: 'Заказ принимает проверенный продавец. Слой за слоем — в среднем 2 дня.', icon: <LayersIcon /> },
  { n: '04', title: 'СДЭК или самовывоз', desc: 'Готов к отгрузке. Трек-номер и статус — в разделе «Заказы».', icon: <TruckIcon /> },
];

export const HowItWorks = () => (
  <section>
    <div className={styles.header}>
      <h2 className={styles.title}>Как это работает</h2>
    </div>
    <div className={styles.grid}>
      {STEPS.map((step) => (
        <div key={step.n} className={styles.step}>
          <span className={styles.icon}>{step.icon}</span>
          <span className={styles.num}>
            <span className={styles.dot} />
            ШАГ {step.n}
          </span>
          <h4 className={styles.stepTitle}>{step.title}</h4>
          <p className={styles.stepDesc}>{step.desc}</p>
        </div>
      ))}
    </div>
  </section>
);
