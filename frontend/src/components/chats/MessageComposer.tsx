import { FormEvent, useState } from 'react';

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
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? 'Написать сообщение...'}
        disabled={disabled}
        style={{
          flex: 1,
          padding: '10px 14px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-2)',
          color: 'var(--text)',
          fontSize: 14
        }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        style={{
          padding: '10px 18px',
          borderRadius: 12,
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        Отправить
      </button>
    </form>
  );
};
