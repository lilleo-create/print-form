import { z } from 'zod';

export const locationDetectRequestSchema = z.object({
  full_address: z.string().min(1),
}).passthrough();

export const locationDetectResponseSchema = z.object({
  geo_id: z.number().optional(),
  location: z.object({ geo_id: z.number().optional() }).optional(),
  result: z.object({ geo_id: z.number().optional() }).optional(),
}).passthrough();

export type LocationDetectRequest = z.infer<typeof locationDetectRequestSchema>;
