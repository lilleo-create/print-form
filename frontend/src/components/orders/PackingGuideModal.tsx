import styles from './PackingGuideModal.module.css';

type Props = { onClose: () => void };

export const PackingGuideModal = ({ onClose }: Props) => (
  <div className={styles.overlay} role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="packing-guide-title">
      <div className={styles.header}>
        <h2 id="packing-guide-title">Как подготовить заказ к отправке</h2>
        <button type="button" aria-label="Закрыть" onClick={onClose}>×</button>
      </div>
      <div className={styles.animation} aria-hidden="true">
        <span>Изделие</span><span>Защита</span><span>Коробка</span>
        <span>Наполнитель</span><span>Весы и рулетка</span><span>Готово</span>
      </div>
      <ol className={styles.steps}>
        <li><strong>Защитите товар</strong><p>Оберните хрупкие и выступающие элементы защитным материалом.</p></li>
        <li><strong>Упакуйте в коробку</strong><p>Используйте прочную коробку подходящего размера. Заполните пустоты, чтобы товар не перемещался внутри.</p></li>
        <li><strong>Взвесьте и измерьте</strong><p>После упаковки взвесьте закрытую коробку и измерьте её внешние длину, ширину и высоту.</p></li>
      </ol>
      <p className={styles.note}>Коробку и упаковочные материалы можно использовать свои или приобрести в CDEK.</p>
      <button type="button" className={styles.done} onClick={onClose}>Понятно</button>
    </div>
  </div>
);
