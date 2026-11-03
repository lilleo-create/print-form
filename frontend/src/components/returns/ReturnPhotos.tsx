import type { ReturnPhoto } from '../../shared/types';
import { PrivateImage } from '../../shared/ui/PrivateImage';

type ReturnPhotosProps = {
  photos?: ReturnPhoto[];
};

export const ReturnPhotos = ({ photos }: ReturnPhotosProps) => {
  if (!photos?.length) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {photos.map((photo) => (
        <PrivateImage
          key={photo.id}
          url={photo.url}
          alt="Фото возврата"
          imageStyle={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
        />
      ))}
    </div>
  );
};
