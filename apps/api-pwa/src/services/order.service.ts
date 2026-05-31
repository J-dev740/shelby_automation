import { db, pool } from '../lib/db.js';
import { priceCart, RawCartLine, PricedCartLine } from './cart.service.js';
import { settingsService } from './settings.service.js';
import { withIdempotency } from '../lib/idempotency.js';
import crypto from 'crypto';

export interface CreateOrderParams {
  customerId: string;
  lines: RawCartLine[];
  customerNote?: string;
  source?: string;
  idempotencyKey?: string;
}

export const orderService = {
  async createOrder(params: CreateOrderParams) {
    if (params.idempotencyKey) {
      return withIdempotency(params.idempotencyKey, 'order_create', async () => {
        return this._executeCreateOrder(params);
      });
    }
    return this._executeCreateOrder(params);
  },

  async _executeCreateOrder(params: CreateOrderParams) {
    // Check kill-switch guard
    if (await settingsService.isDigitalLanePaused()) {
      throw new Error('Digital ordering lane is currently paused.');
    }

    // 1. Price and validate the cart
    const pricedCart = await priceCart(params.lines);

    if (pricedCart.lines.length === 0) {
      throw new Error('Cannot create an order with an empty cart.');
    }

    // Generate a short 6-character uppercase alphanumeric order code
    const orderCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // 2. Perform ACID inserts within a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2a. Insert the main order
      const orderRes = await client.query(
        `INSERT INTO orders (
          order_code, customer_id, source, state, subtotal_inr, total_inr, 
          customer_note, promised_eta_min
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          orderCode,
          params.customerId,
          params.source || 'whatsapp',
          'new',
          pricedCart.subtotal,
          pricedCart.total,
          params.customerNote || null,
          pricedCart.maxPrepTimeMin
        ]
      );
      const orderId = orderRes.rows[0].id;

      // 2b. Insert order status event
      await client.query(
        `INSERT INTO order_status_events (order_id, to_state, reason) VALUES ($1, $2, $3)`,
        [orderId, 'new', 'Order created']
      );

      // 2c. Insert order items and their modifiers
      let position = 1;
      for (const line of pricedCart.lines) {
        const itemRes = await client.query(
          `INSERT INTO order_items (
            order_id, item_id, qty, unit_price_inr, line_total_inr, customer_note, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [
            orderId,
            line.itemId,
            line.qty,
            line.unitPrice,
            line.lineTotal,
            line.customerNote || null,
            position++
          ]
        );
        const orderItemId = itemRes.rows[0].id;

        // Insert modifiers for this line
        for (const mod of line.modifiers) {
          await client.query(
            `INSERT INTO order_item_modifiers (
              order_item_id, modifier_id, modifier_name, price_delta_inr
            ) VALUES ($1, $2, $3, $4)`,
            [
              orderItemId,
              mod.id,
              mod.name,
              mod.priceDelta
            ]
          );
        }
      }

      await client.query('COMMIT');

      return {
        orderId,
        orderCode,
        pricedCart
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updatePaymentIntent(orderId: string, intentId: string, mode: string) {
    await db.query(
      `UPDATE orders SET payment_intent_id = $1, payment_mode = $2 WHERE id = $3`,
      [intentId, mode, orderId]
    );
  },

  async getRecentOrder(customerId: string) {
    const res = await db.query(
      `SELECT o.id, o.order_code, o.state, o.total_inr, o.created_at,
         json_agg(json_build_object('qty', oi.qty, 'name', mi.name)) as items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items mi ON mi.id = oi.item_id
       WHERE o.customer_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [customerId]
    );
    return res.rows[0] || null;
  }
};
