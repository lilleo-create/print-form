import { FormEvent, useState } from 'react';
import styles from './MessageComposer.module.css';

type MessageComposerProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export const MessageComposer = ({ onSend, disabled, placeholder }: MessageComposerProps) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? 'Написать сообщение...'}
        disabled={disabled}
      />
      <button
        type="submit"
        className={styles.sendBtn}
        disabled={disabled || !value.trim()}
        aria-label="Отправить"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M17.5 10L3 3.5l2.5 6.5-2.5 6.5L17.5 10z" fill="currentColor"/>
        </svg>
      </button>
    </form>
  );
};
