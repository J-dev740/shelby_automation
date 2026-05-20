import { z } from 'zod';

export const cartLineSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).max(20),
  modifierIds: z.array(z.string().uuid()).default([]),
  customerNote: z.string().max(80).optional(),
});

export const cartSchema = z.object({
  lines: z.array(cartLineSchema),
  customerNote: z.string().max(140).optional(),
});

export type CartLineInput = z.infer<typeof cartLineSchema>;
export type CartInput = z.infer<typeof cartSchema>;
