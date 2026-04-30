import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';

type ShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  url?: string;
  title?: string;
  image?: string | null;
};

export const ShareModal = ({ isOpen, onClose, url, title }: ShareModalProps) => {
  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Поделиться">
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 14 }}>
        {title ?? 'Поделитесь ссылкой на товар'}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          readOnly
          value={shareUrl}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--bg-2)',
            color: 'var(--text)',
            fontSize: 13
          }}
        />
        <Button onClick={() => void handleCopy()}>Копировать</Button>
      </div>
    </Modal>
  );
};
