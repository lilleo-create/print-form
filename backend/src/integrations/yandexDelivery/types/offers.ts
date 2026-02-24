import { z } from 'zod';

export const offersCreateRequestSchema = z.record(z.unknown());
export const offersCreateResponseSchema = z.object({
  offers: z.array(z.object({ offer_id: z.string().optional() }).passthrough()).optional(),
}).passthrough();

export const offersConfirmRequestSchema = z.object({
  offer_id: z.string().min(1),
}).passthrough();

export const offersConfirmResponseSchema = z.record(z.unknown());
