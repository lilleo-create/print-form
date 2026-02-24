import { z } from 'zod';

export const requestCreateRequestSchema = z.record(z.unknown());
export const requestCreateResponseSchema = z.record(z.unknown());

export const requestInfoResponseSchema = z.record(z.unknown());

export const requestCancelRequestSchema = z.object({
  request_id: z.string().min(1),
}).passthrough();

export const requestCancelResponseSchema = z.record(z.unknown());

export const generateLabelsRequestSchema = z.object({
  request_ids: z.array(z.string().min(1)).min(1),
  generate_type: z.enum(['one', 'many']).default('one'),
  language: z.string().default('ru'),
});

export const handoverActRequestSchema = z.record(z.unknown());
