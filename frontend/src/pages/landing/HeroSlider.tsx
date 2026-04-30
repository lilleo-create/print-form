import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HeroSlider.module.css';

const SLIDES = [
  {
    id: 's1',
    img: 'https://images.unsplash.com/photo-1581092335397-9583eb92d232?w=1600&auto=format&q=80',
    eyebrow: 'Кастомная 3D-печать',
    title: ['От файла до детали', <>за <span className={styles.accent}>2 дня</span></>],
    sub: 'Загрузите модель — мы подберём материал, рассчитаем цену и отправим СДЭК.',
    ctaPrimary: 'Загрузить файл',
    ctaGhost: 'Открыть каталог',
    ctaPrimaryTo: '/catalog',
    ctaGhostTo: '/catalog',
  },
  {
    id: 's2',
    img: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=1600&auto=format&q=80',
    eyebrow: 'Каталог · 1 248 моделей',
    title: ['Готовые модели', <>с <span className={styles.accent}>отгрузкой сегодня</span></>],
    sub: 'Миниатюры, корпуса, автозапчасти — от 84 проверенных производств.',
    ctaPrimary: 'Смотреть каталог',
    ctaGhost: 'Топ продавцов',
    ctaPrimaryTo: '/catalog',
    ctaGhostTo: '/catalog',
  },
  {
    id: 's3',
    img: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=1600&auto=format&q=80',
    eyebrow: 'Продавцам',
    title: ['Поставьте принтер', <><span className={styles.accent}>на поток</span></>],
    sub: 'Кабинет, статусы, чаты, выплаты через ЮKassa — комиссия 3,8%.',
    ctaPrimary: 'Стать партнёром',
    ctaGhost: 'Как это работает',
    ctaPrimaryTo: '/seller/onboarding',
    ctaGhostTo: '/catalog',
  },
];

const STATS = [
  { v: '1 248', l: 'моделей' },
  { v: '84', l: 'производства' },
  { v: '2 дня', l: 'средний срок' },
];

const ArrowLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
);
const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 6l6 6-6 6"/>
  </svg>
);
const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
  </svg>
);

export const HeroSlider = () => {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setIdx((v) => (v + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const go = (n: number) => setIdx(((n % SLIDES.length) + SLIDES.length) % SLIDES.length);
  const s = SLIDES[idx];

  return (
    <section className={styles.slider}>
      <div className={styles.slides}>
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className={`${styles.slide} ${i === idx ? styles.on : ''}`}
          >
            <img src={slide.img} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>

      <div className={styles.slideBody}>
        <span className={styles.eyebrow}>
          <span className={styles.liveDot} />
          {s.eyebrow}
        </span>
        <h1 className={styles.title}>
          {s.title[0]}<br/>{s.title[1]}
        </h1>
        <p className={styles.sub}>{s.sub}</p>
        <div className={styles.ctas}>
          <button className={styles.btnPrimary} onClick={() => navigate(s.ctaPrimaryTo)}>
            {s.ctaPrimary} <ArrowIcon />
          </button>
          <button className={styles.btnGhost} onClick={() => navigate(s.ctaGhostTo)}>
            {s.ctaGhost}
          </button>
        </div>
      </div>

      <div className={styles.stats}>
        {STATS.map((stat) => (
          <div key={stat.l}>
            <div className={styles.statV}>{stat.v}</div>
            <div className={styles.statL}>{stat.l}</div>
          </div>
        ))}
      </div>

      <button className={`${styles.arrow} ${styles.prev}`} onClick={() => go(idx - 1)} aria-label="Назад">
        <ArrowLeft />
      </button>
      <button className={`${styles.arrow} ${styles.next}`} onClick={() => go(idx + 1)} aria-label="Вперёд">
        <ArrowRight />
      </button>

      <div className={styles.dots}>
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            className={i === idx ? styles.dotOn : styles.dot}
            onClick={() => go(i)}
            aria-label={`Слайд ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
};
