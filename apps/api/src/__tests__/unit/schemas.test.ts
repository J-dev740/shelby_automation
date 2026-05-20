import { describe, it, expect } from 'vitest';
import { cartSchema, cartLineSchema } from '../../schemas/cart.zod.js';

describe('Cart Zod Schema Unit Tests', () => {
  const validItem = { itemId: '00000000-0000-0000-0000-000000000001', qty: 2, modifierIds: [] };

  it('E1: Valid cart parses successfully', () => {
    // Note: cartSchema expects an object { lines: [...], customerNote: ... }
    // The old test was passing an array directly.
    const result = cartSchema.safeParse({ lines: [validItem] });
    expect(result.success).toBe(true);
  });

  it('E2/E3/E4: Qty boundaries', () => {
    expect(cartLineSchema.safeParse({ ...validItem, qty: 0 }).success).toBe(false);
    expect(cartLineSchema.safeParse({ ...validItem, qty: 21 }).success).toBe(false);
    expect(cartLineSchema.safeParse({ ...validItem, qty: -1 }).success).toBe(false);
    expect(cartLineSchema.safeParse({ ...validItem, qty: 1 }).success).toBe(true);
    expect(cartLineSchema.safeParse({ ...validItem, qty: 20 }).success).toBe(true);
  });

  it('E5: Invalid UUID', () => {
    expect(cartLineSchema.safeParse({ ...validItem, itemId: 'invalid' }).success).toBe(false);
  });

  it('E6: customerNote length', () => {
    const longNote = 'a'.repeat(81);
    expect(cartLineSchema.safeParse({ ...validItem, customerNote: longNote }).success).toBe(false);
    expect(cartLineSchema.safeParse({ ...validItem, customerNote: 'a'.repeat(80) }).success).toBe(true);
  });
});
