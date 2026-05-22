import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { razorpayService } from '../services/razorpay.service.js';
import { db } from '../lib/db.js';
import { MESSAGES } from '../orchestrator/messages.js';
import { QueueMessagingProvider } from '../adapters/messaging/queue.provider.js';

export default async function razorpayWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhook/razorpay', async (request, reply) => {
    // 1. Verify Signature if Secret is configured
    if (env.RAZORPAY_KEY_SECRET) {
      const rawBody = (request as any).rawBody as Buffer;
      const signature = request.headers['x-razorpay-signature'] as string;
      if (!signature || !razorpayService.verifyWebhookSignature(rawBody, signature, env.RAZORPAY_KEY_SECRET)) {
        fastify.log.warn('⚠️ Invalid Razorpay webhook signature');
        return reply.code(403).send('Invalid signature');
      }
    }

    const body = request.body as any;
    
    // 2. Handle Payment Link Paid Event
    if (body.event === 'payment_link.paid') {
      const entity = body.payload.payment_link.entity;
      const orderId = entity.reference_id; // This is our DB order.id
      
      if (!orderId) {
        return reply.code(200).send('No reference_id');
      }

      // Update Order Status in DB
      const res = await db.query(
        `UPDATE orders SET payment_status = 'paid' WHERE id = $1 RETURNING order_code, customer_id`,
        [orderId]
      );

      if (res.rowCount && res.rowCount > 0) {
        const order = res.rows[0];
        
        // Fetch customer phone to send a confirmation
        const custRes = await db.query(`SELECT phone_e164 FROM customers WHERE id = $1`, [order.customer_id]);
        if (custRes.rowCount && custRes.rowCount > 0) {
          const phone = custRes.rows[0].phone_e164;
          
          const provider = new QueueMessagingProvider();

          await provider.sendText(phone, MESSAGES.PAYMENT_RECEIVED(order.order_code));
        }
      }
    }

    return reply.code(200).send({ status: 'ok' });
  });
}
