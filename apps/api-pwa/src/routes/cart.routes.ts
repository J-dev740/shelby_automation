import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { priceCart, ItemUnavailableError, ModifierValidationError } from '../services/cart.service.js';

const priceCartSchema = z.object({
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    qty: z.number().int().min(1).max(20),
    modifierIds: z.array(z.string().uuid()).default([]),
  })).min(1),
});

export async function cartRoutes(app: FastifyInstance) {
  app.post('/cart/price', async (request, reply) => {
    try {
      const parsed = priceCartSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid cart data',
          details: parsed.error.flatten(),
        });
      }

      const pricedCart = await priceCart(parsed.data.lines);
      return pricedCart;
    } catch (err: any) {
      if (err instanceof ItemUnavailableError) {
        return reply.status(422).send({
          error: 'Item unavailable',
          itemId: err.itemId,
          message: err.message,
        });
      }
      if (err instanceof ModifierValidationError) {
        return reply.status(422).send({
          error: 'Modifier validation failed',
          message: err.message,
        });
      }
      app.log.error(err, 'Failed to price cart');
      return reply.status(500).send({ error: 'Failed to price cart' });
    }
  });
}
