import { useNavigate } from 'react-router-dom';
import styles from './SellerCTA.module.css';

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
  </svg>
);

const STATS = [
  { v: '3.8 %', l: 'комиссия маркетплейса' },
  { v: '7 дней', l: 'средний выход в деньги' },
  { v: '84', l: 'активных продавца' },
  { v: '12 480', l: 'заказов в месяц' },
];

export const SellerCTA = () => {
  const navigate = useNavigate();

  return (
    <section className={styles.block}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>Продавцам</span>
        <h3 className={styles.h3}>Поставьте принтер на поток</h3>
        <p className={styles.p}>
          Размещайте свои модели или принимайте заказы по чужим STL.
          Кабинет, статусы, чаты, выплаты через ЮKassa — всё уже настроено.
        </p>
        <div className={styles.ctas}>
          <button className={styles.btnPrimary} onClick={() => navigate('/seller/onboarding')}>
            Открыть кабинет продавца <ArrowIcon />
          </button>
          <button className={styles.btnGhost}>Как стать партнёром</button>
        </div>
      </div>

      <div className={styles.stats}>
        {STATS.map((s) => (
          <div key={s.l} className={styles.stat}>
            <div className={styles.statV}>{s.v}</div>
            <div className={styles.statL}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
