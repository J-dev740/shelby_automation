import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { orderService } from '../services/order.service.js';
import { sessionService } from '../services/session.service.js';
import { settingsService } from '../services/settings.service.js';
import { ItemUnavailableError } from '../services/cart.service.js';
import { sanitizeNote } from '../services/notes.sanitizer.js';
import { db } from '../lib/db.js';

const createOrderSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    qty: z.number().int().min(1).max(20),
    modifierIds: z.array(z.string().uuid()).default([]),
  })).min(1),
  customerNote: z.string().max(140).optional(),
  idempotencyKey: z.string().min(1),
});

const phoneParamSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
});

export async function orderRoutes(app: FastifyInstance) {
  // POST /api/orders — Create order
  app.post('/orders', async (request, reply) => {
    try {
      const parsed = createOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid order data',
          details: parsed.error.flatten(),
        });
      }

      const { phone, lines, customerNote, idempotencyKey } = parsed.data;

      // Check digital lane before anything
      if (await settingsService.isDigitalLanePaused()) {
        return reply.status(503).send({
          error: 'digital_lane_paused',
          message: 'Kitchen is slammed right now — try again soon!',
        });
      }

      // Get or create customer
      const customer = await sessionService.getOrCreateCustomer(phone);

      // Create order
      const result = await orderService.createOrder({
        customerId: customer.id,
        lines,
        customerNote: sanitizeNote(customerNote, 'order'),
        source: 'pwa',
        idempotencyKey: `pwa:${idempotencyKey}`,
      });

      return {
        orderId: result.orderId,
        orderCode: result.orderCode,
        total: result.pricedCart.total,
        eta_min: result.pricedCart.maxPrepTimeMin,
      };
    } catch (err: any) {
      if (err instanceof ItemUnavailableError) {
        return reply.status(422).send({
          error: 'Item unavailable',
          itemId: err.itemId,
          message: err.message,
        });
      }
      if (err.message === 'Cannot create an order with an empty cart.') {
        return reply.status(400).send({ error: 'empty_cart', message: err.message });
      }
      if (err.message === 'Digital ordering lane is currently paused.') {
        return reply.status(503).send({ error: 'digital_lane_paused', message: err.message });
      }
      app.log.error(err, 'Failed to create order');
      return reply.status(500).send({ error: 'Failed to create order' });
    }
  });

  // GET /api/orders/:phone/active — Active orders for polling
  app.get('/orders/:phone/active', async (request, reply) => {
    try {
      const params = phoneParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid phone number' });
      }

      const { phone } = params.data;

      const res = await db.query(
        `SELECT o.id, o.order_code, o.state, o.total_inr, o.created_at, o.promised_eta_min,
           COALESCE(
             json_agg(
               json_build_object('qty', oi.qty, 'name', mi.name)
             ) FILTER (WHERE oi.id IS NOT NULL),
             '[]'
           ) as items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN menu_items mi ON mi.id = oi.item_id
         JOIN customers c ON c.id = o.customer_id
         WHERE c.phone_e164 = $1
           AND o.state NOT IN ('completed', 'cancelled')
           AND o.created_at > now() - interval '2 hours'
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
        [phone]
      );

      return { orders: res.rows };
    } catch (err: any) {
      app.log.error(err, 'Failed to fetch active orders');
      return reply.status(500).send({ error: 'Failed to fetch active orders' });
    }
  });
}
