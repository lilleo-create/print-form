import { useState } from 'react';
import { Button } from '../../shared/ui/Button';
import styles from './MessageComposer.module.css';

interface MessageComposerProps {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
}

export const MessageComposer = ({ onSend, disabled }: MessageComposerProps) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.composer}>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Введите сообщение"
        disabled={disabled || sending}
      />
      <Button type="button" onClick={handleSend} disabled={disabled || sending}>
        Отправить
      </Button>
    </div>
  );
};
