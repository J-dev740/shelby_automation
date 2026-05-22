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
  if (message.type === 'text') input = message.text.body.toLowerCase().trim();
  if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
    input = message.interactive.button_reply.id;
  }
  if (message.type === 'interactive' && message.interactive.type === 'list_reply') {
    input = message.interactive.list_reply.id;
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

  if (input === 'btn_handoff' || input === 'action_handoff') {
    await sessionService.updateSession(session.id, { state: 'handoff_active' });
    await provider.sendText(from, MESSAGES.HANDOFF_ACTIVE);
    return;
  }

  // --- WELCOME / IDLE ---
  if (input === 'hi' || input === 'hello' || input === 'menu' || session.state === 'idle') {
    if (await settingsService.isDigitalLanePaused()) {
      await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
      return;
    }

    await sessionService.updateSession(session.id, { state: 'browsing_categories', cart_json: [] });
    
    // Fetch categories
    const catRes = await db.query(`SELECT id, name FROM menu_categories WHERE active = true ORDER BY sort_order`);
    const rows = catRes.rows.map(c => ({ id: `cat_${c.id}`, title: c.name }));

    await provider.sendText(from, MESSAGES.WELCOME);
    await provider.sendListMessage(from, MESSAGES.CATEGORY_PROMPT, 'View Menu', [
      { title: 'Categories', rows }
    ]);
    return;
  }

  // --- BROWSING CATEGORIES -> Select Category ---
  if (session.state === 'browsing_categories' && input.startsWith('cat_')) {
    const catId = input.replace('cat_', '');
    const itemRes = await db.query(`SELECT id, name, price_inr FROM menu_items WHERE category_id = $1 AND active = true ORDER BY sort_order`, [catId]);
    
    if (itemRes.rowCount === 0) {
      await provider.sendText(from, "No items found in this category.");
      return;
    }

    const rows = itemRes.rows.map(item => ({
      id: `item_${item.id}`,
      title: item.name,
      description: `₹${item.price_inr}`
    }));

    await sessionService.updateSession(session.id, { state: 'browsing_items' });
    await provider.sendListMessage(from, MESSAGES.ITEM_PROMPT, 'Select Item', [
      { title: 'Drinks & Food', rows }
    ]);
    return;
  }

  // --- BROWSING ITEMS -> Select Item ---
  if ((session.state === 'browsing_items' || session.state === 'browsing_categories') && input.startsWith('item_')) {
    const itemId = input.replace('item_', '');
    const itemRes = await db.query(`SELECT id, name, price_inr FROM menu_items WHERE id = $1 AND active = true`, [itemId]);
    
    if (itemRes.rowCount === 0) {
      await provider.sendText(from, MESSAGES.ITEM_UNAVAILABLE);
      return;
    }

    const item = itemRes.rows[0];
    
    // Check if item is already in cart, if so, increase qty
    let newCart = [...session.cart_json];
    const existingIdx = newCart.findIndex((l: any) => l.itemId === itemId);
    let qty = 1;
    if (existingIdx >= 0) {
      newCart[existingIdx].qty += 1;
      qty = newCart[existingIdx].qty;
    } else {
      newCart.push({ itemId, qty: 1, modifierIds: [] });
    }

    await sessionService.updateSession(session.id, { state: 'ordering', cart_json: newCart });
    
    await provider.sendInteractiveButtons(from, MESSAGES.ADDED_TO_CART(qty, item.name, item.price_inr * qty), [
      { id: 'btn_view_cart', title: '🛒 View Cart' },
      { id: 'btn_menu', title: '➕ Add More' },
      { id: 'btn_checkout', title: '✅ Checkout' }
    ]);
    return;
  }

  // --- ORDERING -> Add More ---
  if ((session.state === 'ordering' || session.state === 'checkout_confirm') && input === 'btn_menu') {
    await sessionService.updateSession(session.id, { state: 'browsing_categories' });
    const catRes = await db.query(`SELECT id, name FROM menu_categories WHERE active = true ORDER BY sort_order`);
    const rows = catRes.rows.map(c => ({ id: `cat_${c.id}`, title: c.name }));
    await provider.sendListMessage(from, MESSAGES.CATEGORY_PROMPT, 'View Menu', [
      { title: 'Categories', rows }
    ]);
    return;
  }

  // --- ORDERING -> View Cart / Checkout ---
  if (session.state === 'ordering' && (input === 'btn_view_cart' || input === 'btn_checkout')) {
    if (!session.cart_json || session.cart_json.length === 0) {
      await provider.sendText(from, MESSAGES.CART_EMPTY);
      return;
    }

    // Build cart summary
    let cartLines = [];
    let total = 0;
    for (const line of session.cart_json) {
      const itemRes = await db.query(`SELECT name, price_inr FROM menu_items WHERE id = $1`, [line.itemId]);
      if (itemRes.rowCount && itemRes.rowCount > 0) {
        const item = itemRes.rows[0];
        const lineTotal = item.price_inr * line.qty;
        total += lineTotal;
        cartLines.push(`• ${line.qty}x ${item.name} (₹${lineTotal})`);
      }
    }

    await sessionService.updateSession(session.id, { state: 'checkout_confirm' });
    await provider.sendInteractiveButtons(from, MESSAGES.CHECKOUT_CONFIRM(cartLines, total), [
      { id: 'btn_confirm_order', title: '🚀 Place Order' },
      { id: 'btn_menu', title: '✏️ Add More' },
      { id: 'reset', title: '❌ Cancel' }
    ]);
    return;
  }

  // --- CHECKOUT CONFIRM -> Place Order ---
  if (session.state === 'checkout_confirm' && input === 'btn_confirm_order') {
    if (await settingsService.isDigitalLanePaused()) {
      await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
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
    return;
  }

  // Catch-all
  await provider.sendText(from, MESSAGES.UNRECOGNIZED_INPUT);
}
