import { useMemo, useRef } from 'react';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';
import { Rating } from '../../../../shared/ui/Rating';
import { useModalFocus } from '../../../../shared/lib/useModalFocus';
import type { Shop } from '../../../../shared/types';
import styles from './ShopInfoModal.module.css';

interface ShopInfoModalProps {
  shop: Shop | null;
  isOpen: boolean;
  onClose: () => void;
  onComplaint: () => void;
}

const formatCompactNumber = (value?: number | null) => {
  if (!value && value !== 0) return null;
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

export const ShopInfoModal = ({ shop, isOpen, onClose, onComplaint }: ShopInfoModalProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, contentRef);

  const legalRows = useMemo(() => {
    if (!shop?.legalInfo) return [];
    const entries = Object.entries(shop.legalInfo).filter(([, value]) => Boolean(value));
    return entries.map(([key, value]) => ({
      key,
      label:
        key === 'name'
          ? 'Название'
          : key === 'status'
            ? 'Статус'
            : key === 'phone'
              ? 'Телефон'
              : key === 'city'
                ? 'Город'
                : key === 'referenceCategory'
                  ? 'Категория'
                  : key === 'catalogPosition'
                    ? 'Позиция в каталоге'
                    : key === 'ogrn'
                      ? 'ОГРН'
                      : key === 'inn'
                        ? 'ИНН'
                        : key,
      value: String(value)
    }));
  }, [shop?.legalInfo]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className={styles.modal}>
      <div ref={contentRef}>
        <header className={styles.header}>
          <h2>{shop?.title ?? 'Магазин'}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть окно">
            ✕
          </button>
        </header>
        <div className={styles.metrics}>
          <div>
            <Rating value={shop?.rating ?? 0} count={shop?.reviewsCount ?? 0} size="sm" />
            <span className={styles.metricLabel}>
              {formatCompactNumber(shop?.reviewsCount) ?? '0'} оценок
            </span>
          </div>
          {shop?.subscribersCount && (
            <div>
              <div className={styles.metricValue}>{formatCompactNumber(shop.subscribersCount)}</div>
              <div className={styles.metricLabel}>Подписчиков</div>
            </div>
          )}
          {shop?.ordersCount && (
            <div>
              <div className={styles.metricValue}>{formatCompactNumber(shop.ordersCount)}</div>
              <div className={styles.metricLabel}>Заказов</div>
            </div>
          )}
        </div>
        <div className={styles.legal}>
          <div className={styles.legalTitle}>Юридическая информация</div>
          {legalRows.length ? (
            <ul className={styles.legalList}>
              {legalRows.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.legalEmpty}>Нет данных</p>
          )}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onComplaint}>
            Пожаловаться
          </Button>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </Modal>
  );
};
