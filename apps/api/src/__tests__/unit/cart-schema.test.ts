import { describe, it, expect } from 'vitest';
import { cartSchema, cartLineSchema } from '../../schemas/cart.zod.js';

describe('Cart Zod Schema Validation', () => {
  describe('Cart Line Validation', () => {
    it('E1: Valid cart line parses successfully', () => {
      const validLine = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        qty: 2,
        modifierIds: ['123e4567-e89b-12d3-a456-426614174001'],
        customerNote: 'No ice please',
      };
      const result = cartLineSchema.safeParse(validLine);
      expect(result.success).toBe(true);
    });

    it('E2: qty: 0 → Zod rejects (min 1)', () => {
      const invalidLine = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        qty: 0,
      };
      const result = cartLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('greater than or equal to 1');
      }
    });

    it('E3: qty: 21 → Zod rejects (max 20)', () => {
      const invalidLine = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        qty: 21,
      };
      const result = cartLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('less than or equal to 20');
      }
    });

    it('E4: qty: -5 → Zod rejects', () => {
      const invalidLine = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        qty: -5,
      };
      const result = cartLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
    });

    it('E5: itemId: "not-a-uuid" → Zod rejects', () => {
      const invalidLine = {
        itemId: 'not-a-uuid',
        qty: 1,
      };
      const result = cartLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid uuid');
      }
    });

    it('E6: customerNote > 80 chars → Zod rejects', () => {
      const invalidLine = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        qty: 1,
        customerNote: 'a'.repeat(81),
      };
      const result = cartLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at most 80');
      }
    });
  });

  describe('Order-level Validation', () => {
    it('E7: Order-level customerNote > 140 chars → Zod rejects', () => {
      const invalidCart = {
        lines: [
          {
            itemId: '123e4567-e89b-12d3-a456-426614174000',
            qty: 1,
          },
        ],
        customerNote: 'a'.repeat(141),
      };
      const result = cartSchema.safeParse(invalidCart);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at most 140');
      }
    });
  });
});
