// frontend/src/shared/validation/photos.ts
import { z } from 'zod';

export const PHOTO = {
  maxCount: 5,
  maxSizeBytes: 8 * 1024 * 1024, // 8MB
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'] as const
};

export const photoFileSchema = z
  .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, {
    message: 'Файл не выбран'
  })
  .refine((f) => PHOTO.allowedMime.includes(f.type as any), {
    message: 'Разрешены только JPG/PNG/WEBP'
  })
  .refine((f) => f.size <= PHOTO.maxSizeBytes, {
    message: `Максимальный размер фото: ${Math.round(PHOTO.maxSizeBytes / 1024 / 1024)}MB`
  });

/**
 * URL schema:
 * - допускаем абсолютные URL (https://...)
 * - и относительные пути типа /uploads/xxx.jpg
 *   (потому что z.string().url() будет ругаться на относительные)
 */
export const photoUrlSchema = z
  .string()
  .min(1, 'Пустая ссылка на фото')
  .refine(
    (s) => {
      if (s.startsWith('/uploads/')) return true;
      try {
        // абсолютные URL
        new URL(s);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Некорректная ссылка на фото' }
  );

/**
 * Универсальный "фото-элемент": либо File (для формы), либо string url/path (после аплоада)
 */
export const photoAnySchema = z.union([photoFileSchema, photoUrlSchema]);

export const photosAnyArraySchema = z
  .array(photoAnySchema)
  .max(PHOTO.maxCount, `Максимум ${PHOTO.maxCount} фото`);

/**
 * Только файлы (например, перед upload)
 */
export const photosFilesArraySchema = z
  .array(photoFileSchema)
  .max(PHOTO.maxCount, `Максимум ${PHOTO.maxCount} фото`);

/**
 * Только ссылки/пути (например, перед отправкой payload на бэк после upload)
 */
export const photosUrlsArraySchema = z
  .array(photoUrlSchema)
  .max(PHOTO.maxCount, `Максимум ${PHOTO.maxCount} фото`);

export function fileListToArray(list?: FileList | null): File[] {
  if (!list) return [];
  return Array.from(list).filter((f) => f && f.size > 0);
}

/**
 * Удобный хелпер: валидируем и возвращаем либо ошибки (чтобы показать рядом с полем),
 * либо нормальные files.
 */
export function validatePhotoFiles(files: File[]) {
  const parsed = photosFilesArraySchema.safeParse(files);
  if (parsed.success) return { ok: true as const, files: parsed.data };
  return {
    ok: false as const,
    issues: parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message
    }))
  };
}
