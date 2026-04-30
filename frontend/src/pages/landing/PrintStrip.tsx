import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './PrintStrip.module.css';

type QueueRow = {
  id: string;
  name: string;
  meta: string;
  pct: number;
  state: 'live' | 'done' | 'queued';
};

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <path d="M17 8l-5-5-5 5"/>
    <path d="M12 3v12"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
  </svg>
);

export const PrintStrip = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueRow[]>([
    { id: 'PF-2418', name: 'Шестерня M1.5 · PETG', meta: '0.20 мм · 35% запол.', pct: 78, state: 'live' },
    { id: 'PF-2417', name: 'Корпус Raspberry Pi · PLA', meta: '0.16 мм · 25% запол.', pct: 100, state: 'done' },
    { id: 'PF-2419', name: 'Миниатюра «Воин» · смола', meta: '0.05 мм · сплошное', pct: 0, state: 'queued' },
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      setQueue((q) =>
        q.map((r) => {
          if (r.state === 'live') {
            const next = Math.min(100, r.pct + 1);
            return { ...r, pct: next, state: next === 100 ? 'done' : 'live' };
          }
          return r;
        })
      );
    }, 800);
    return () => clearInterval(t);
  }, []);

  return (
    <section className={styles.strip}>
      <div className={styles.lhs}>
        <span className={styles.eyebrow}>Своя модель</span>
        <h3 className={styles.h3}>Загрузите STL — получите цену через 12 секунд</h3>
        <p className={styles.p}>
          Конфигуратор подбирает материал, считает заполнение и время печати, выводит цену по часам станка. Бесплатно, без регистрации.
        </p>
        <div className={styles.uploadZone}>
          <span className={styles.uploadIc}><UploadIcon /></span>
          <div className={styles.uploadCol}>
            <span className={styles.uploadTitle}>Перетащите STL, OBJ или STEP</span>
            <span className={styles.uploadMeta}>До 100 МБ · мгновенный расчёт</span>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => navigate('/catalog')}>
            Открыть конфигуратор <ArrowIcon />
          </button>
          <button className={styles.btnGhost}>Как мы считаем цену</button>
        </div>
      </div>

      <div className={styles.queue}>
        <div className={styles.qHead}>
          <span className={styles.qTitle}>Очередь печати · производство #04</span>
          <span className={styles.liveTag}>
            <span className={styles.liveDot} /> В работе
          </span>
        </div>
        {queue.map((row) => (
          <div key={row.id} className={`${styles.qRow} ${styles[row.state]}`}>
            <span className={styles.ord}>#{row.id.split('-')[1]}</span>
            <div className={styles.qCol}>
              <div className={styles.qTop}>{row.name}</div>
              <div className={styles.qMeta}>{row.meta}</div>
              <div className={styles.progress}>
                <div className={styles.fill} style={{ width: `${row.pct}%` }} />
              </div>
            </div>
            <span className={styles.pct}>
              {row.state === 'queued' ? 'в очереди' : row.state === 'done' ? 'готово' : `${row.pct}%`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
