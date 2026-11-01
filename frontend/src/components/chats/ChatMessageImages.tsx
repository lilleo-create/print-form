import type { ChatMessageAttachment } from '../../shared/types';
import { resolveMediaUrl } from '../../shared/lib/resolveMediaUrl';
import styles from './ChatMessageImages.module.css';

export const ChatMessageImages = ({ attachments }: { attachments?: ChatMessageAttachment[] }) => {
  const images = attachments?.filter(item => item.type === 'IMAGE') ?? [];
  if (!images.length) return null;
  return <div className={styles.grid}>
    {images.map(image => {
      const src = resolveMediaUrl(image.url);
      if (!src) return null;
      return <a key={image.id} href={src} target="_blank" rel="noopener noreferrer" aria-label={`Открыть фото ${image.fileName}`}>
        <img src={src} alt={image.fileName || 'Фото в чате'} loading="lazy" />
      </a>;
    })}
  </div>;
};
