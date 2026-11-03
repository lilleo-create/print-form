import { useEffect, useState } from 'react';
import { apiClient } from '../api/api';
import { resolveMediaUrl } from '../lib/resolveMediaUrl';

export const privateMediaPath = (url: string): string | null => {
  if (url.startsWith('/private-files/')) return url;
  if (url.startsWith('/uploads/chats/')) return url.replace('/uploads/chats/', '/private-files/chats/');
  if (url.startsWith('/uploads/returns/')) return url.replace('/uploads/returns/', '/private-files/returns/legacy/');
  return null;
};

export const usePrivateImageUrl = (url: string): string | null => {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    const path = privateMediaPath(url);
    if (!path) { setSource(resolveMediaUrl(url)); return; }
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setSource(null);
    void apiClient.requestBlob(path, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setSource(null); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return source;
};

type PrivateImageProps = {
  url: string;
  alt: string;
  imageStyle?: React.CSSProperties;
  openable?: boolean;
  ariaLabel?: string;
};

export const PrivateImage = ({ url, alt, imageStyle, openable = false, ariaLabel }: PrivateImageProps) => {
  const source = usePrivateImageUrl(url);
  const image = <img src={source ?? ''} alt={alt} style={imageStyle} loading="lazy" />;
  return openable
    ? <a href={source ?? '#'} onClick={event => { if (!source) event.preventDefault(); }}
        aria-disabled={!source} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>{image}</a>
    : image;
};
