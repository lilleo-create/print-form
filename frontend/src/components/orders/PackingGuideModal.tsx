import { useRef, useState } from 'react';
import { PackingStepIllustration } from './PackingStepIllustration';
import styles from './PackingGuideModal.module.css';

type Props = { onClose: () => void };

const steps = [
  { title: 'Подготовьте товар', text: 'Проверьте изделие перед отправкой: нет ли трещин, сколов, царапин и других дефектов.', tip: 'Проверьте выступающие и хрупкие части.' },
  { title: 'Защитите товар', text: 'Оберните товар в пузырчатую плёнку, мягкую бумагу или другой защитный материал, чтобы он не повредился при перевозке.', tip: 'Особенно внимательно защитите углы и тонкие детали.' },
  { title: 'Подберите коробку', text: 'Используйте коробку с небольшим запасом. Внутри не должно быть пустот — добавьте наполнитель, если товар болтается.', tip: 'Товар не должен перемещаться внутри коробки.' },
  { title: 'Закройте и измерьте упаковку', text: 'После упаковки заклейте коробку и измерьте её вес, внешнюю длину, ширину и высоту. Именно эти данные нужны для расчёта доставки.', tip: 'Взвешивайте уже закрытую коробку вместе с наполнителем.' },
  { title: 'Сдача в CDEK', text: 'После подтверждения упаковки вы сможете создать отправление. В пункте CDEK коробку могут перемерить, поэтому фактическая стоимость доставки может немного отличаться.', tip: 'Наклейте этикетку и сохраните документы отправления.' }
];

export const PackingGuideModal = ({ onClose }: Props) => {
  const [step, setStep] = useState(0);
  const touchStart = useRef<number | null>(null);
  const current = steps[step];
  const previous = () => setStep(value => Math.max(0, value - 1));
  const next = () => setStep(value => Math.min(steps.length - 1, value + 1));

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="packing-guide-title">
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ИНСТРУКЦИЯ ДЛЯ ПРОДАВЦА</span>
            <h2 id="packing-guide-title">Как правильно упаковать заказ</h2>
          </div>
          <button type="button" className={styles.close} aria-label="Закрыть" onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.progressHeader}>
            <span>Шаг {step + 1} из {steps.length}</span>
            <span>{step + 1} / {steps.length}</span>
          </div>
          <div className={styles.progress} aria-hidden="true">
            {steps.map((item, index) => <span className={index <= step ? styles.progressActive : ''} key={item.title} />)}
          </div>

          <div className={styles.slide} aria-live="polite" onTouchStart={event => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }} onTouchEnd={event => {
            const start = touchStart.current;
            touchStart.current = null;
            const end = event.changedTouches[0]?.clientX;
            if (start === null || end === undefined || Math.abs(end - start) < 55) return;
            if (end < start) next(); else previous();
          }}>
            <div className={styles.illustration}><PackingStepIllustration step={step} /></div>
            <div className={styles.copy}>
              <span className={styles.stepNumber}>0{step + 1}</span>
              <h3>{current.title}</h3>
              <p>{current.text}</p>
              <div className={styles.tip}><span aria-hidden="true">✦</span>{current.tip}</div>
            </div>
          </div>
          <p className={styles.note}>Коробку и упаковочные материалы можно использовать свои или приобрести в CDEK.</p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.back} onClick={previous} disabled={step === 0}>Назад</button>
          {step < steps.length - 1
            ? <button type="button" className={styles.next} onClick={next}>Далее</button>
            : <button type="button" className={styles.next} onClick={onClose}>Готово</button>}
        </div>
      </div>
    </div>
  );
};
