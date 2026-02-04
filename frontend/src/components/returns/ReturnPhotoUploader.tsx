import { useEffect, useMemo } from 'react';
import styles from './ReturnPhotoUploader.module.css';

const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

interface ReturnPhotoUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string | null;
}

export const ReturnPhotoUploader = ({ files, onChange, error }: ReturnPhotoUploaderProps) => {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length >= MAX_FILES) break;
      if (!allowedTypes.includes(file.type)) continue;
      if (file.size > MAX_SIZE) continue;
      next.push(file);
    }
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.root}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />
      <p className={styles.helper}>Максимум 10 файлов, jpg/png/webp, до 10MB каждый.</p>
      {error && <p className={styles.error}>{error}</p>}
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
