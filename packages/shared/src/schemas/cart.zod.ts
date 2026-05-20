import { z } from 'zod';

export const modifierSelectionSchema = z.object({
  modifierId: z.string().uuid(),
});

export const cartItemSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).max(20),
  modifiers: z.array(modifierSelectionSchema).default([]),
  customerNote: z.string().max(80).optional(),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema).default([]),
  customerNote: z.string().max(140).optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
