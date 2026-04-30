import { ChangeEvent } from 'react';

type ReturnPhotoUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  maxPhotos?: number;
  error?: string | null;
};

export const ReturnPhotoUploader = ({ files, onChange, maxPhotos = 5, error }: ReturnPhotoUploaderProps) => {
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    onChange([...files, ...selected].slice(0, maxPhotos));
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {files.map((file, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img
              src={URL.createObjectURL(file)}
              alt=""
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
            />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              style={{
                position: 'absolute', top: 2, right: 2, width: 20, height: 20,
                borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)',
                color: '#fff', cursor: 'pointer', fontSize: 10
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {files.length < maxPhotos && (
          <label
            style={{
              width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px dashed var(--border)', borderRadius: 8, cursor: 'pointer',
              color: 'var(--muted)', fontSize: 24
            }}
          >
            +
            <input type="file" accept="image/*" multiple hidden onChange={handleFile} />
          </label>
        )}
      </div>
      {error && <p style={{ margin: 0, color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>До {maxPhotos} фото</p>
    </div>
  );
};
