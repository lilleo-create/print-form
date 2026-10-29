import { useEffect, useRef, useState } from 'react';
import { normalizeApiError } from '../../shared/api/client';
import { formatPrice } from '../../shared/lib/formatPrice';
import styles from './PackedOrderModal.module.css';

export type PackedParcelInput = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

type Field = keyof PackedParcelInput;
type FormValues = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;

type Props = {
  initial?: Partial<PackedParcelInput>;
  sellerNetBeforeDeliveryKopecks: number;
  onClose: () => void;
  onQuote: (parcel: PackedParcelInput) => Promise<{ deliveryAmountKopecks: number }>;
  onConfirm: (parcel: PackedParcelInput, expectedDeliveryAmountKopecks: number) => Promise<void>;
};

const fields: { key: Field; label: string; empty: string; invalid: string; max: number; step: string }[] = [
  { key: 'weightGrams', label: 'Вес упаковки, г', empty: 'Укажите вес закрытой коробки.',
    invalid: 'Введите целое число от 1 до 100 000 г.', max: 100_000, step: '1' },
  { key: 'lengthCm', label: 'Длина, см', empty: 'Укажите длину коробки.',
    invalid: 'Введите размер больше 0 и не более 300 см.', max: 300, step: 'any' },
  { key: 'widthCm', label: 'Ширина, см', empty: 'Укажите ширину коробки.',
    invalid: 'Введите размер больше 0 и не более 300 см.', max: 300, step: 'any' },
  { key: 'heightCm', label: 'Высота, см', empty: 'Укажите высоту коробки.',
    invalid: 'Введите размер больше 0 и не более 300 см.', max: 300, step: 'any' }
];

const validate = (values: FormValues): { parcel: PackedParcelInput | null; errors: FieldErrors } => {
  const errors: FieldErrors = {};
  const numbers = {} as PackedParcelInput;
  for (const field of fields) {
    const raw = values[field.key].trim();
    if (!raw) {
      errors[field.key] = field.empty;
      continue;
    }
    const number = Number(raw);
    if (!Number.isFinite(number) || number <= 0 || number > field.max ||
      (field.key === 'weightGrams' && !Number.isSafeInteger(number))) {
      errors[field.key] = field.invalid;
      continue;
    }
    numbers[field.key] = number;
  }
  return { parcel: Object.keys(errors).length ? null : numbers, errors };
};

export const PackedOrderModal = ({ initial, sellerNetBeforeDeliveryKopecks, onClose, onQuote, onConfirm }: Props) => {
  const [values, setValues] = useState<FormValues>({
    weightGrams: initial?.weightGrams?.toString() ?? '',
    lengthCm: initial?.lengthCm?.toString() ?? '',
    widthCm: initial?.widthCm?.toString() ?? '',
    heightCm: initial?.heightCm?.toString() ?? ''
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const afterDelivery = quote === null ? null : sellerNetBeforeDeliveryKopecks - quote;

  useEffect(() => {
    if (quote !== null && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [quote]);

  const change = (field: Field, value: string) => {
    setValues(previous => ({ ...previous, [field]: value }));
    setFieldErrors(previous => ({ ...previous, [field]: undefined }));
    setError(null);
    setQuote(null);
  };

  const checkedParcel = () => {
    const result = validate(values);
    setFieldErrors(result.errors);
    return result.parcel;
  };

  const calculate = async () => {
    const parcel = checkedParcel();
    if (!parcel) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onQuote(parcel);
      setQuote(result.deliveryAmountKopecks);
    } catch (cause) {
      setQuote(null);
      const code = normalizeApiError(cause).code ?? (cause instanceof Error ? cause.message : '');
      if (code === 'PACKED_WEIGHT_TOO_LOW') {
        setFieldErrors(previous => ({ ...previous, weightGrams: 'Вес посылки не может быть меньше веса товаров.' }));
      } else if (code === 'PACKED_DIMENSIONS_TOO_SMALL') {
        setFieldErrors(previous => ({ ...previous, lengthCm: 'Коробка меньше товара. Проверьте все внешние размеры.' }));
      } else {
        setError('Не удалось рассчитать доставку. Проверьте параметры и попробуйте снова.');
      }
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    const parcel = checkedParcel();
    if (!parcel || quote === null || afterDelivery === null || afterDelivery < 0) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(parcel, quote);
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
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ПОДГОТОВКА К ОТПРАВКЕ</span>
            <h2 id="packed-order-title">Укажите параметры упакованной посылки</h2>
          </div>
          <button type="button" className={styles.close} aria-label="Закрыть" onClick={onClose} disabled={busy}>×</button>
        </div>

        <div className={styles.body} ref={bodyRef}>
          <div className={styles.intro}>
            <span className={styles.introIcon} aria-hidden="true">▣</span>
            <p>Укажите вес и внешние размеры уже закрытой коробки, а не самого товара. По ним рассчитаем доставку CDEK. Это предварительная стоимость: после приёмки она может немного измениться.</p>
          </div>

          <div className={styles.fields}>
            {fields.map(field => (
              <div className={styles.field} key={field.key}>
                <label htmlFor={`packed-${field.key}`}>{field.label}</label>
                <input id={`packed-${field.key}`} type="number" min="0" max={field.max} step={field.step}
                  inputMode={field.key === 'weightGrams' ? 'numeric' : 'decimal'}
                  value={values[field.key]} disabled={busy}
                  aria-invalid={Boolean(fieldErrors[field.key])}
                  aria-describedby={fieldErrors[field.key] ? `packed-${field.key}-error` : undefined}
                  onChange={event => change(field.key, event.target.value)} />
                {fieldErrors[field.key] && <span id={`packed-${field.key}-error`} className={styles.fieldError} role="alert">{fieldErrors[field.key]}</span>}
              </div>
            ))}
          </div>

          <div className={styles.memo}>
            <strong>Перед расчётом</strong>
            <ul>
              <li>Указывайте вес и размеры уже закрытой коробки.</li>
              <li>Не измеряйте сам товар без упаковки.</li>
              <li>CDEK может проверить размеры при приёмке.</li>
            </ul>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {quote !== null && (
            <div className={styles.quote} aria-live="polite">
              <div className={styles.quoteHeading}>
                <span>РАСЧЁТ CDEK</span>
                <strong>Расчётная стоимость доставки: {formatPrice(quote)}</strong>
              </div>
              <p>Покупатель доставку не оплачивает. Стоимость доставки будет удержана с продавца при расчёте по заказу.</p>
              <div className={styles.netRow}>
                <span>После вычета доставки</span>
                <strong>{afterDelivery !== null && afterDelivery >= 0 ? formatPrice(afterDelivery) : '—'}</strong>
              </div>
              {afterDelivery !== null && afterDelivery < 0 &&
                <p className={styles.error}>Стоимость доставки превышает сумму к выплате. Отправление создать нельзя.</p>}
              <small>Фактическая стоимость может измениться после проверки посылки в CDEK.</small>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={busy}>Отмена</button>
          <button type="button" className={styles.calculate} onClick={() => void calculate()} disabled={busy}>
            {busy ? 'Подождите…' : 'Рассчитать доставку'}
          </button>
          {quote !== null && <button type="button" className={styles.confirm} onClick={() => void confirm()}
            disabled={busy || afterDelivery === null || afterDelivery < 0}>Подтвердить упаковку</button>}
        </div>
      </div>
    </div>
  );
};
