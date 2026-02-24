import { z } from 'zod';
import { uuidSchema, digitsSchema } from './common';

export const pickupPointsListRequestSchema = z.object({
  pickup_point_ids: z.array(z.string()).optional(),
  geo_id: z.number().optional(),
  type: z.string().optional(),
  is_post_office: z.boolean().optional(),
  latitude: z.object({ from: z.number(), to: z.number() }).optional(),
  longitude: z.object({ from: z.number(), to: z.number() }).optional(),
}).passthrough();

export const pickupPointSchema = z.object({
  id: z.unknown().optional(),
  point_id: z.unknown().optional(),
  pickup_point_id: z.unknown().optional(),
  platform_station_id: z.unknown().optional(),
  operator_station_id: z.unknown().optional(),
  name: z.unknown().optional(),
  address: z.unknown().optional(),
  latitude: z.unknown().optional(),
  longitude: z.unknown().optional(),
  location: z.record(z.unknown()).optional(),
}).passthrough();

export const pickupPointsListResponseSchema = z.object({
  points: z.array(pickupPointSchema).optional(),
  result: z.object({ points: z.array(pickupPointSchema).optional() }).optional(),
}).passthrough();

export const normalizedPickupPointSchema = z.object({
  pickupPointId: z.string(),
  name: z.string().optional(),
  address: z.string().optional(),
  platformStationId: uuidSchema.optional(),
  operatorStationId: digitsSchema.optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type PickupPointsListRequest = z.infer<typeof pickupPointsListRequestSchema>;
export type PickupPointsListResponse = z.infer<typeof pickupPointsListResponseSchema>;
export type NormalizedPickupPoint = z.infer<typeof normalizedPickupPointSchema>;
