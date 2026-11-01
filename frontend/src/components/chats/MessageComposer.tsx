import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
  };
  useEffect(resize, [value]);
  useEffect(() => {
    if (!focusKey) return;
    setValue(draft ?? '');
    inputRef.current?.focus();
  }, [focusKey]);

  const send = async () => {
    const trimmed = value.trim();
    if (!trimmed || sendingRef.current || disabled) return;
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        rows={1}
        className={styles.input}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onValueChange?.(e.target.value);
        }}
        onKeyDown={handleKeyDown}
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
