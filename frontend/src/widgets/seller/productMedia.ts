export const IMAGE_MAX_SIZE_BYTES = 15 * 1024 * 1024;
export const VIDEO_MAX_SIZE_BYTES = 200 * 1024 * 1024;
export const VIDEO_MAX_DURATION_SECONDS = 120;

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v'
]);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'qt', 'webm', 'm4v']);

export type ProductMediaKind = 'image' | 'video';

const getFileExtension = (filename: string): string => {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
};

export const detectProductMediaKind = (file: File): ProductMediaKind | null => {
  const type = file.type.toLowerCase();
  const extension = getFileExtension(file.name);

  if (IMAGE_MIME_TYPES.has(type) || IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (VIDEO_MIME_TYPES.has(type) || VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }

  return null;
};

export const PRODUCT_MEDIA_ACCEPT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.mp4',
  '.mov',
  '.qt',
  '.webm',
  '.m4v',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v'
].join(',');

export const formatSize = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;

export const getVideoDuration = async (file: File): Promise<number> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = objectUrl;

      const cleanup = () => {
        video.removeAttribute('src');
        video.load();
      };

      video.onloadedmetadata = () => {
        const loadedDuration = Number.isFinite(video.duration) ? video.duration : NaN;
        cleanup();
        if (Number.isNaN(loadedDuration) || loadedDuration <= 0) {
          reject(new Error('VIDEO_METADATA_INVALID'));
          return;
        }
        resolve(loadedDuration);
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('VIDEO_METADATA_READ_FAILED'));
      };
    });

    return duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
