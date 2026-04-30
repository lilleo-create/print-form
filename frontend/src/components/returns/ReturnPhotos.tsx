import type { ReturnPhoto } from '../../shared/types';
import { resolveReturnPhotoUrl } from '../../shared/lib/resolveReturnPhotoUrl';

type ReturnPhotosProps = {
  photos?: ReturnPhoto[];
};

export const ReturnPhotos = ({ photos }: ReturnPhotosProps) => {
  if (!photos?.length) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {photos.map((photo) => (
        <img
          key={photo.id}
          src={resolveReturnPhotoUrl(photo.url)}
          alt="Фото возврата"
          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
        />
      ))}
    </div>
  );
};
