import { useState } from 'react';
import { YaPvzPickerModal, type YaPvzSelection } from '../../../components/delivery/YaPvzPickerModal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedPoint?: YaPvzSelection | null;
  onConfirm: (payload: YaPvzSelection) => Promise<void>;
};

export const PickupPointModal = ({ isOpen, onClose, selectedPoint, onConfirm }: Props) => {
  const [saving, setSaving] = useState(false);

  const handleSelect = (selection: YaPvzSelection) => {
    setSaving(true);
    void onConfirm(selection).finally(() => setSaving(false));
  };

  return (
    <>
      {saving ? <p style={{ marginBottom: 8 }}>Сохраняем выбранный ПВЗ…</p> : null}
      <YaPvzPickerModal
        isOpen={isOpen}
        onClose={onClose}
        onSelect={handleSelect}
        params={{ selected_point_id: selectedPoint?.pvzId }}
        containerIdPrefix="checkout-ya-pvz"
      />
    </>
  );
};
