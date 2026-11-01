import { FormEvent, useEffect, useRef, useState } from 'react';
import styles from './MessageComposer.module.css';

type MessageComposerProps = {
  onSend: (text: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  placeholder?: string;
  draft?: string;
  focusKey?: number;
  onValueChange?: (value: string) => void;
};

export const MessageComposer = ({ onSend, disabled, placeholder, draft, focusKey, onValueChange }: MessageComposerProps) => {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focusKey) return;
    setValue(draft ?? '');
    inputRef.current?.focus();
  }, [focusKey]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const sent = await onSend(trimmed);
      if (sent !== false) {
        setValue('');
        onValueChange?.('');
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onValueChange?.(e.target.value);
        }}
        placeholder={placeholder ?? 'Написать сообщение...'}
        disabled={disabled || sending}
      />
      <button
        type="submit"
        className={styles.sendBtn}
        disabled={disabled || sending || !value.trim()}
        aria-label="Отправить"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M17.5 10L3 3.5l2.5 6.5-2.5 6.5L17.5 10z" fill="currentColor"/>
        </svg>
      </button>
    </form>
  );
};
