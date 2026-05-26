import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { decryptFlowRequest, encryptFlowResponse } from '../lib/flow-crypto.js';
import fs from 'fs';
import path from 'path';
import { db } from '../lib/db.js';
import { sessionService } from '../services/session.service.js';

interface FlowRequest {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
}

export default async function (fastify: FastifyInstance) {
  // We need the raw private key (with newlines preserved)
  let privateKeyPem: string | undefined;

  // Since Railway handles multiline env vars differently, we prefer raw string from env, fallback to file
  if (env.FLOW_PRIVATE_KEY) {
    // If it's a single line string, try to restore newlines if they got stripped, but usually Railway passes \n
    privateKeyPem = env.FLOW_PRIVATE_KEY.replace(/\\n/g, '\n');
  } else if (process.env.FLOW_PRIVATE_KEY_PATH) {
    try {
      const keyPath = path.resolve(process.cwd(), process.env.FLOW_PRIVATE_KEY_PATH);
      privateKeyPem = fs.readFileSync(keyPath, 'utf8');
    } catch (e) {
      fastify.log.warn(`Could not read FLOW_PRIVATE_KEY_PATH: ${e}`);
    }
  }

  fastify.post('/flows/data', async (request: FastifyRequest<{ Body: FlowRequest }>, reply: FastifyReply) => {
    if (!privateKeyPem) {
      fastify.log.error('Flow private key not configured.');
      return reply.code(500).send({ error: 'Server configuration error' });
    }

    try {
      const { encrypted_flow_data, encrypted_aes_key, initial_vector } = request.body;
      
      // 1. Decrypt incoming payload
      const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptFlowRequest(
        encrypted_aes_key,
        encrypted_flow_data,
        initial_vector,
        privateKeyPem
      );

      fastify.log.info({ decryptedBody }, 'Received Flow Request');
      const action = decryptedBody.action;

      let responseData: any = {};

      // 2. Handle 'ping' (Health check from WhatsApp Manager)
      if (action === 'ping') {
        responseData = {
          version: '3.0',
          data: {
            status: 'active'
          }
        };
      } 
      // 3. Handle 'INIT' (Data request on first screen load)
      else if (action === 'INIT') {
        // Fetch active menu items
        const menuRes = await db.query(`SELECT id, name, price_inr FROM menu_items WHERE active = true ORDER BY category_id, sort_order`);
        
        const menu_items = menuRes.rows.map(item => ({
          id: item.id.toString(),
          title: item.name.substring(0, 30),
          description: `₹${item.price_inr}`
        }));

        // Generate quantity options (1 to 10)
        const qty_options = Array.from({ length: 10 }, (_, i) => ({
          id: (i + 1).toString(),
          title: (i + 1).toString()
        }));

        responseData = {
          version: '3.0',
          screen: 'ORDER_SCREEN',
          data: {
            menu_items,
            qty_options
          }
        };
      }
      // 4. Handle 'complete' (User submitted the order)
      else if (action === 'data_exchange' && decryptedBody.data?.action === 'complete') {
         // In Step 11, we will process the submitted items, save them to the session, and move to checkout.
         // For now, just send a success screen or data so the simulator doesn't crash.
         responseData = {
          version: '3.0',
          screen: 'SUCCESS',
          data: {
            msg: "Order received in backend! (Step 11 will process this)"
          }
        };
      }

      // 5. Encrypt Response
      const encryptedResponseBase64 = encryptFlowResponse(responseData, aesKeyBuffer, initialVectorBuffer);

      return reply.send(encryptedResponseBase64);

    } catch (err: any) {
      fastify.log.error(err, 'Failed to process Flow Request');
      // If decryption fails or data is invalid, return HTTP 421 per Meta docs
      return reply.code(421).send({ error: 'Flow decryption or processing failed' });
    }
  });
}
