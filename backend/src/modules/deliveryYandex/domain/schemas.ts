/**
 * Zod schemas for Yandex API responses. Validate before use.
 */

import { z } from 'zod';

const uuidSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const digitsSchema = z.string().trim().regex(/^\d+$/);

/** One raw point from pickup-points/list (API can return various shapes) */
export const yandexPickupPointRawSchema = z
  .object({
    id: z.unknown().optional(),
    point_id: z.unknown().optional(),
    platform_station_id: z.unknown().optional(),
    station_id: z.unknown().optional(),
    operator_station_id: z.unknown().optional(),
    name: z.unknown().optional(),
    address: z.unknown().optional(),
    latitude: z.unknown().optional(),
    longitude: z.unknown().optional(),
    location: z.record(z.unknown()).optional(),
    geo: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type YandexPickupPointRaw = z.infer<typeof yandexPickupPointRawSchema>;

/** Response of POST /api/b2b/platform/pickup-points/list */
export const yandexPickupPointsListResponseSchema = z.object({
  points: z.array(yandexPickupPointRawSchema).optional(),
  result: z
    .object({
      points: z.array(yandexPickupPointRawSchema).optional(),
    })
    .optional(),
});

export type YandexPickupPointsListResponse = z.infer<
  typeof yandexPickupPointsListResponseSchema
>;

/** Request body for POST pickup-points/list (common variants) */
export const yandexPickupPointsListRequestSchema = z
  .object({
    pickup_point_ids: z.array(z.string()).optional(),
    geo_id: z.number().optional(),
    type: z.string().optional(),
    latitude: z
      .object({
        from: z.number(),
        to: z.number(),
      })
      .optional(),
    longitude: z
      .object({
        from: z.number(),
        to: z.number(),
      })
      .optional(),
    is_post_office: z.boolean().optional(),
  })
  .passthrough();

export type YandexPickupPointsListRequest = z.infer<
  typeof yandexPickupPointsListRequestSchema
>;

export { uuidSchema, digitsSchema };
