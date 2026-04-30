import type { ReturnReason } from '../../shared/types';

const REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'DAMAGED', label: 'Брак/повреждение' },
  { value: 'WRONG_ITEM', label: 'Не тот товар' },
  { value: 'NOT_FIT', label: 'Не подошёл' }
];

type ReturnReasonRadioGroupProps = {
  value: ReturnReason;
  onChange: (value: ReturnReason) => void;
};

export const ReturnReasonRadioGroup = ({ value, onChange }: ReturnReasonRadioGroupProps) => (
  <div style={{ display: 'grid', gap: 8 }}>
    {REASONS.map((reason) => (
      <label
        key={reason.value}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}
      >
        <input
          type="radio"
          name="return-reason"
          value={reason.value}
          checked={value === reason.value}
          onChange={() => onChange(reason.value)}
        />
        {reason.label}
      </label>
    ))}
  </div>
);
