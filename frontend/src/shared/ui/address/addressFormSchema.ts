import { z } from 'zod';

export const addressFormSchema = z
  .object({
    addressText: z.string().min(3, 'Введите адрес'),
    apartment: z.string().optional(),
    floor: z.string().optional(),
    label: z.string().optional(),
    isFavorite: z.boolean().default(false),
    courierComment: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (data.isFavorite && !data.label?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Укажите название адреса',
        path: ['label']
      });
    }
  });

export type AddressFormValues = z.infer<typeof addressFormSchema>;
