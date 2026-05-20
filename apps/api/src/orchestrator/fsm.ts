import { MessagingProvider } from '../adapters/messaging/provider.interface.js';
import { sessionService } from '../services/session.service.js';
import { orderService } from '../services/order.service.js';
import { settingsService } from '../services/settings.service.js';
import { db } from '../lib/db.js';
import { MESSAGES } from './messages.js';
import { razorpayService } from '../services/razorpay.service.js';

export async function handleIncomingMessage(
  from: string, 
  message: any, 
  provider: MessagingProvider
) {
  let session = await sessionService.getOrCreateSession(from);
  
  // 1. Extract intent (cheap layer: buttons first, then text)
  let input = '';
  if (message.type === 'text') input = message.text.body.toLowerCase();
  if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
    input = message.interactive.button_reply.id;
  }

  console.log(`[FSM] User: ${from} | State: ${session.state} | Input: ${input}`);

  // Handle reset from any state
  if (input === 'reset') {
    await sessionService.updateSession(session.id, { state: 'idle', cart_json: [] });
    await provider.sendText(from, MESSAGES.RESET_SUCCESS);
    return;
  }

  // If handoff is active, stay silent unless they reset
  if (session.state === 'handoff_active') {
    return;
  }

  // 2. Simple State Machine Routing
  if (input === 'hi' || input === 'hello' || session.state === 'idle') {
    if (await settingsService.isDigitalLanePaused()) {
      await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
      return;
    }

    await sessionService.updateSession(session.id, { state: 'ordering', cart_json: [] });
    await provider.sendInteractiveButtons(from, MESSAGES.WELCOME, [
      { id: 'btn_coffee', title: '☕ Cold Coffee' },
      { id: 'btn_tea', title: '🍵 Masala Tea' },
      { id: 'btn_handoff', title: '🙋 Talk to Staff' }
    ]);
  } 
  else if (session.state === 'ordering') {
    if (input === 'btn_coffee' || input === 'btn_tea') {
      if (await settingsService.isDigitalLanePaused()) {
        await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
        return;
      }

      const slug = input === 'btn_coffee' ? 'cold-coffee' : 'masala-tea';
      const itemRes = await db.query(`SELECT id, name FROM menu_items WHERE slug = $1`, [slug]);
      
      if (itemRes.rowCount === 0) {
        await provider.sendText(from, MESSAGES.ITEM_UNAVAILABLE);
        return;
      }

      const itemId = itemRes.rows[0].id;
      const itemName = itemRes.rows[0].name;

      // Add to cart as RawCartLine
      const newCart = [...session.cart_json, { itemId, qty: 1, modifierIds: [] }];
      await sessionService.updateSession(session.id, { cart_json: newCart });

      await provider.sendInteractiveButtons(from, MESSAGES.ADDED_TO_CART(itemName), [
        { id: 'btn_checkout', title: '🛒 Checkout' },
        { id: input === 'btn_coffee' ? 'btn_tea' : 'btn_coffee', title: input === 'btn_coffee' ? '🍵 Add Tea' : '☕ Add Coffee' }
      ]);
    } else if (input === 'btn_checkout') {
      if (await settingsService.isDigitalLanePaused()) {
        await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
        return;
      }

      if (!session.cart_json || session.cart_json.length === 0) {
        await provider.sendText(from, MESSAGES.CART_EMPTY);
        return;
      }

      try {
        const orderRes = await orderService.createOrder({
          customerId: session.customer_id,
          lines: session.cart_json,
          idempotencyKey: `order:${message.id}`
        });

        await sessionService.updateSession(session.id, { state: 'idle', cart_json: [] });
        const itemNames = orderRes.pricedCart.lines.map(l => `${l.qty}x ${l.itemName}`).join(', ');
        
        let paymentLinkUrl: string | undefined;
        if (razorpayService.isConfigured()) {
          const plink = await razorpayService.createPaymentLink(
            orderRes.orderId,
            orderRes.orderCode,
            orderRes.pricedCart.total,
            from
          );
          await orderService.updatePaymentIntent(orderRes.orderId, plink.id, 'razorpay');
          paymentLinkUrl = plink.short_url;
        }

        await provider.sendText(
          from, 
          MESSAGES.ORDER_CONFIRMED(orderRes.orderCode, itemNames, orderRes.pricedCart.maxPrepTimeMin, paymentLinkUrl)
        );
      } catch (err: any) {
        if (err.message === 'Digital ordering lane is currently paused.') {
          await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
        } else {
          await provider.sendText(from, MESSAGES.ORDER_ERROR(err.message));
        }
      }
    } else if (input === 'btn_handoff') {
      await sessionService.updateSession(session.id, { state: 'handoff_active' });
      await provider.sendText(from, MESSAGES.HANDOFF_ACTIVE);
    } else {
      await provider.sendText(from, MESSAGES.UNRECOGNIZED_INPUT);
    }
  }
}
