import { ReturnReason } from '../../shared/types';
import styles from './ReturnReasonRadioGroup.module.css';

interface ReturnReasonRadioGroupProps {
  value: ReturnReason;
  onChange: (value: ReturnReason) => void;
}

const options: { value: ReturnReason; label: string }[] = [
  { value: 'NOT_FIT', label: 'Не подошло' },
  { value: 'DAMAGED', label: 'Брак или повреждение' },
  { value: 'WRONG_ITEM', label: 'Привезли не то' }
];

export const ReturnReasonRadioGroup = ({
  value,
  onChange
}: ReturnReasonRadioGroupProps) => {
  return (
    <div className={styles.group}>
      {options.map((option) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name="return-reason"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className={styles.label}>{option.label}</span>
        </label>
      ))}
    </div>
  );
};
