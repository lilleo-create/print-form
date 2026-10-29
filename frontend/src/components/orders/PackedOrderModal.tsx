import { useState } from 'react';
import { formatPrice } from '../../shared/lib/formatPrice';
import { normalizeApiError } from '../../shared/api/client';
import styles from './PackedOrderModal.module.css';

export type PackedParcelInput = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

type Props = {
  initial?: Partial<PackedParcelInput>;
  onClose: () => void;
  onQuote: (parcel: PackedParcelInput) => Promise<{ deliveryAmountKopecks: number }>;
  onConfirm: (parcel: PackedParcelInput, expectedDeliveryAmountKopecks: number) => Promise<void>;
};

export const PackedOrderModal = ({ initial, onClose, onQuote, onConfirm }: Props) => {
  const [weight, setWeight] = useState(initial?.weightGrams?.toString() ?? '');
  const [length, setLength] = useState(initial?.lengthCm?.toString() ?? '');
  const [width, setWidth] = useState(initial?.widthCm?.toString() ?? '');
  const [height, setHeight] = useState(initial?.heightCm?.toString() ?? '');
  const [quote, setQuote] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setQuote(null);
    setError(null);
  };

  const parcel = (): PackedParcelInput | null => {
    const values = [Number(weight), Number(length), Number(width), Number(height)];
    if (!Number.isSafeInteger(values[0]) || values[0] <= 0 || values[0] > 100_000 ||
        values.slice(1).some(value => !Number.isFinite(value) || value <= 0 || value > 300)) {
      setError('Укажите положительный вес в граммах и внешние размеры коробки в сантиметрах.');
      return null;
    }
    return { weightGrams: values[0], lengthCm: values[1], widthCm: values[2], heightCm: values[3] };
  };

  const calculate = async () => {
    const input = parcel();
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onQuote(input);
      setQuote(result.deliveryAmountKopecks);
    } catch (cause) {
      setQuote(null);
      const code = normalizeApiError(cause).code ?? (cause instanceof Error ? cause.message : '');
      setError(code === 'PACKED_WEIGHT_TOO_LOW'
        ? 'Вес готовой посылки не может быть меньше веса товаров.'
        : code === 'PACKED_DIMENSIONS_TOO_SMALL'
          ? 'Коробка меньше товара. Проверьте внешние размеры посылки.'
          : 'Не удалось рассчитать доставку. Проверьте параметры и попробуйте снова.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    const input = parcel();
    if (!input || quote === null) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(input, quote);
    } catch (cause) {
      setQuote(null);
      const code = normalizeApiError(cause).code ?? (cause instanceof Error ? cause.message : '');
      setError(code === 'PACKED_QUOTE_CHANGED'
        ? 'Стоимость доставки изменилась. Рассчитайте её ещё раз перед подтверждением.'
        : 'Не удалось подтвердить упаковку. Пересчитайте доставку и попробуйте снова.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="packed-order-title">
        <div className={styles.heading}>
          <h2 id="packed-order-title">Укажите параметры готовой посылки</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} disabled={busy}>×</button>
        </div>
        <div className={styles.fields}>
          <label>Вес с упаковкой, г<input type="number" min="1" max="100000" step="1" value={weight}
            onChange={event => change(setWeight)(event.target.value)} /></label>
          <label>Длина, см<input type="number" min="0.1" max="300" step="any" value={length}
            onChange={event => change(setLength)(event.target.value)} /></label>
          <label>Ширина, см<input type="number" min="0.1" max="300" step="any" value={width}
            onChange={event => change(setWidth)(event.target.value)} /></label>
          <label>Высота, см<input type="number" min="0.1" max="300" step="any" value={height}
            onChange={event => change(setHeight)(event.target.value)} /></label>
        </div>
        <p className={styles.hint}>Измерьте уже закрытую коробку вместе с упаковкой.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {quote !== null && (
          <div className={styles.quote}>
            <strong>Расчётная стоимость доставки: {formatPrice(quote)}</strong>
            <p>Доставку оплачивает Print-Form. Эта сумма будет учтена в расчёте по заказу. CDEK может скорректировать стоимость после проверки веса и габаритов в ПВЗ.</p>
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" onClick={() => void calculate()} disabled={busy}>Рассчитать доставку</button>
          {quote !== null && <button type="button" onClick={() => void confirm()} disabled={busy}>
            Подтвердить упаковку
          </button>}
        </div>
      </div>
    </div>
  );
};
