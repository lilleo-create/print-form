import { z } from 'zod';

export const uuidSchema = z.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const digitsSchema = z.string().trim().regex(/^\d+$/);

export const yandexErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  details: z.unknown().optional(),
}).passthrough();

export type YandexErrorDto = z.infer<typeof yandexErrorSchema>;
