import type { ChatMessageAttachment } from '../../shared/types';
import { PrivateImage } from '../../shared/ui/PrivateImage';
import styles from './ChatMessageImages.module.css';

export const ChatMessageImages = ({ attachments }: { attachments?: ChatMessageAttachment[] }) => {
  const images = attachments?.filter(item => item.type === 'IMAGE') ?? [];
  if (!images.length) return null;
  return <div className={styles.grid}>
    {images.map(image => {
      return <PrivateImage key={image.id} url={image.url} alt={image.fileName || 'Фото в чате'}
        openable ariaLabel={`Открыть фото ${image.fileName}`} />;
    })}
  </div>;
};
