import { useEffect, useMemo, useState } from 'react';
import styles from './ReturnPhotoUploader.module.css';

const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

interface ReturnPhotoUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string | null;
}

export const ReturnPhotoUploader = ({
  files,
  onChange,
  error
}: ReturnPhotoUploaderProps) => {
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    const errors: string[] = [];
    for (const file of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        errors.push('Можно добавить не больше 10 фото');
        break;
      }
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Неподдерживаемый формат`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        errors.push(`${file.name}: Файл слишком большой`);
        continue;
      }
      next.push(file);
    }
    setLocalError(
      errors.length
        ? `${errors.length} файла(ов) не добавлены: ${errors.join('; ')}`
        : null
    );
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
    setLocalError(null);
  };

  return (
    <div className={styles.root}>
      <input
        id="return-photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className={styles.input}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <p className={styles.helper}>
        Максимум 10 файлов, jpg/png/webp, до 10MB каждый.
      </p>
      {(error || localError) && (
        <p className={styles.error}>{error ?? localError}</p>
      )}
      {files.length > 0 && (
        <div className={styles.grid}>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className={styles.preview}>
              <img src={previews[index]} alt={file.name} />
              <button type="button" onClick={() => handleRemove(index)}>
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
