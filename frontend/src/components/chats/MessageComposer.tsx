import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { ChatSendPayload } from '../../shared/api/api';
import styles from './MessageComposer.module.css';

type MessageComposerProps = {
  onSend: (payload: ChatSendPayload) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  placeholder?: string;
  draft?: string;
  focusKey?: number;
  onValueChange?: (value: string) => void;
};

export const MessageComposer = ({ onSend, disabled, placeholder, draft, focusKey, onValueChange }: MessageComposerProps) => {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach(image => URL.revokeObjectURL(image.preview)), []);
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
    if ((!trimmed && !images.length) || sendingRef.current || disabled) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const sent = await onSend({ text: trimmed, ...(images.length ? { files: images.map(image => image.file) } : {}) });
      if (sent !== false) {
        setValue('');
        onValueChange?.('');
        images.forEach(image => URL.revokeObjectURL(image.preview));
        setImages([]);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch {
      setFileError('Не удалось отправить сообщение. Попробуйте ещё раз.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files);
    const valid = next.filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 10 * 1024 * 1024);
    const available = Math.max(0, 5 - images.length);
    if (valid.length !== next.length) setFileError('Можно прикрепить JPG, PNG или WEBP до 10 МБ.');
    else if (valid.length > available) setFileError('Можно прикрепить не более 5 фотографий.');
    else setFileError(null);
    setImages(current => [...current, ...valid.slice(0, available).map(file => ({ file, preview: URL.createObjectURL(file) }))]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (preview: string) => {
    URL.revokeObjectURL(preview);
    setImages(current => current.filter(image => image.preview !== preview));
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
      {images.length > 0 && <div className={styles.previews}>
        {images.map(image => <div key={image.preview} className={styles.preview}>
          <img src={image.preview} alt={image.file.name} />
          <button type="button" aria-label={`Убрать ${image.file.name}`} onClick={() => removeImage(image.preview)} disabled={sending}>×</button>
        </div>)}
      </div>}
      {fileError && <p className={styles.fileError} role="alert">{fileError}</p>}
      <input ref={fileRef} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => addImages(event.target.files)} aria-label="Выбрать фотографии" disabled={disabled || sending} />
      <button type="button" className={styles.attachBtn} aria-label="Прикрепить фото" onClick={() => fileRef.current?.click()} disabled={disabled || sending}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5l-8.1 8.1a5 5 0 01-7.1-7.1l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-2.8-2.8l8.3-8.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
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
        disabled={disabled || sending || (!value.trim() && images.length === 0)}
        aria-label="Отправить"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M17.5 10L3 3.5l2.5 6.5-2.5 6.5L17.5 10z" fill="currentColor"/>
        </svg>
      </button>
      {sending && images.length > 0 && <span className={styles.sendingNote}>Загружаем фото…</span>}
    </form>
  );
};
