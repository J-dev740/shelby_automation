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
  // [STEP 1] Load or create session
  console.log(`[FSM:START] from=${from} msgType=${message.type}`);
  let session = await sessionService.getOrCreateSession(from);
  console.log(`[FSM:SESSION] id=${session.id} state=${session.state} cartLen=${session.cart_json?.length ?? 0}`);
  
  // [STEP 2] Extract intent
  let input = '';
  if (message.type === 'text') input = message.text.body.toLowerCase().trim();
  if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
    input = message.interactive.button_reply.id;
  }
  if (message.type === 'interactive' && message.interactive.type === 'list_reply') {
    input = message.interactive.list_reply.id;
  }
  console.log(`[FSM:INPUT] input="${input}" state=${session.state}`);

  // --- GLOBAL COMMANDS ---
  // If the user sends an image, audio, or sticker, input will be empty
  if (!input) {
    console.log(`[FSM:UNRECOGNIZED] Non-text message type: ${message.type}`);
    await provider.sendText(from, MESSAGES.UNRECOGNIZED_INPUT);
    return;
  }

  if (input === 'cancel' || input === 'reset' || input === 'empty') {
    console.log(`[FSM:RESET] Resetting session for ${from}`);
    await sessionService.clearSession(session.id);
    await provider.sendText(from, MESSAGES.RESET_SUCCESS);
    return;
  }

  if (input === 'help' || input === 'staff' || input === 'btn_handoff' || input === 'action_handoff') {
    console.log(`[FSM:HANDOFF] Engaging handoff for ${from}`);
    await sessionService.updateSession(session.id, { state: 'handoff_active' });
    await provider.sendText(from, MESSAGES.HANDOFF_ACTIVE);
    return;
  }

  // If handoff is active, stay silent unless they reset
  if (session.state === 'handoff_active') {
    console.log(`[FSM:HANDOFF] Session is in handoff mode — ignoring message`);
    return;
  }

  if (input === 'cart' || input === 'action_cart') {
    console.log(`[FSM:CART] User requested cart from state=${session.state}`);
    const cart = session.cart_json || [];
    if (cart.length === 0) {
      await provider.sendText(from, MESSAGES.CART_EMPTY);
      // Fall through to show the welcome menu
      input = 'menu';
    } else {
      await sessionService.updateSession(session.id, { state: 'cart_review' });
      session.state = 'cart_review';
      input = '__enter_cart_review';
    }
  }

  if (input === 'status' || input === 'track' || input === 'action_status') {
    console.log(`[FSM:STATUS] Checking order status for ${from}`);
    const recentOrder = await orderService.getRecentOrder(session.customer_id);
    if (!recentOrder) {
      await provider.sendText(from, MESSAGES.ORDER_NOT_FOUND);
    } else {
      let timeAgo = 'Just now';
      const diffMin = Math.floor((new Date().getTime() - new Date(recentOrder.created_at).getTime()) / 60000);
      if (diffMin > 0) timeAgo = `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
      if (diffMin > 60) timeAgo = `${Math.floor(diffMin/60)} hour${Math.floor(diffMin/60) > 1 ? 's' : ''} ago`;
      
      const itemsStr = recentOrder.items ? recentOrder.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ') : 'Unknown items';
      await provider.sendText(from, MESSAGES.ORDER_STATUS(
        recentOrder.order_code, 
        recentOrder.state, 
        timeAgo, 
        itemsStr, 
        Number(recentOrder.total_inr)
      ));
    }
    return;
  }

  // --- WELCOME / IDLE ---
  if (input === 'hi' || input === 'hello' || input === 'menu' || session.state === 'idle') {
    console.log(`[FSM:WELCOME] Checking digital lane status...`);
    if (await settingsService.isDigitalLanePaused()) {
      console.log(`[FSM:WELCOME] Digital lane is PAUSED`);
      await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
      return;
    }

    // New state is 'browsing'. We clear the cart here as in legacy 'idle' -> 'browsing_categories'
    await sessionService.updateSession(session.id, { state: 'browsing', cart_json: [] });
    console.log(`[FSM:WELCOME] Fetching active menu categories...`);
    const catRes = await db.query(`SELECT id, name FROM menu_categories WHERE active = true ORDER BY sort_order`);
    console.log(`[FSM:WELCOME] Found ${catRes.rowCount} categories`);

    if (!catRes.rows || catRes.rows.length === 0) {
      console.log(`[FSM:WELCOME] WARNING — No categories in DB! Seed may not have run.`);
      await provider.sendText(from, 'Our menu is being updated. Please try again in a moment!');
      return;
    }

    const rows = catRes.rows.map(c => ({ id: `cat_${c.id}`, title: c.name.substring(0, 24) }));
    console.log(`[FSM:WELCOME] Sending welcome text + category list to ${from}`);
    await provider.sendText(from, MESSAGES.WELCOME);
    
    // New utility list layout
    await provider.sendListMessage(from, MESSAGES.CATEGORY_PROMPT, 'View Menu', [
      { title: 'Categories', rows },
      { title: 'Options', rows: [
        { id: 'action_cart', title: '🛒 View My Cart' },
        { id: 'action_status', title: '📦 Track My Order' },
        { id: 'action_handoff', title: '👋 Talk to Staff' }
      ]}
    ]);
    console.log(`[FSM:WELCOME] Done — state=browsing`);
    return;
  }

  // --- BROWSING CATEGORIES -> Select Category ---
  if ((session.state === 'browsing' || session.state === 'browsing_categories') && input.startsWith('cat_')) {
    const catId = input.replace('cat_', '');
    console.log(`[FSM:CAT] User selected catId=${catId}`);
    const itemRes = await db.query(
      `SELECT id, name, price_inr FROM menu_items WHERE category_id = $1 AND active = true ORDER BY sort_order`,
      [catId]
    );
    console.log(`[FSM:CAT] Found ${itemRes.rowCount} items in category`);
    
    if (!itemRes.rows || itemRes.rows.length === 0) {
      await provider.sendText(from, 'No items found in this category.');
      return;
    }

    const rows = itemRes.rows.map(item => ({
      id: `item_${item.id}`,
      title: item.name.substring(0, 24),
      description: `Rs.${item.price_inr}`
    }));

    await sessionService.updateSession(session.id, { state: 'browsing_items' });
    console.log(`[FSM:CAT] Sending item list — state=browsing_items`);
    await provider.sendListMessage(from, MESSAGES.ITEM_PROMPT, 'Select Item', [
      { title: 'Drinks & Food', rows }
    ]);
    return;
  }

  // --- BROWSING ITEMS -> Select Item ---
  if ((session.state === 'browsing_items' || session.state === 'browsing_categories') && input.startsWith('item_')) {
    const itemId = input.replace('item_', '');
    console.log(`[FSM:ITEM] User selected itemId=${itemId}`);
    const itemRes = await db.query(
      `SELECT id, name, price_inr FROM menu_items WHERE id = $1 AND active = true`,
      [itemId]
    );
    
    if (!itemRes.rows || itemRes.rows.length === 0) {
      console.log(`[FSM:ITEM] Item not found or inactive — itemId=${itemId}`);
      await provider.sendText(from, MESSAGES.ITEM_UNAVAILABLE);
      return;
    }

    const item = itemRes.rows[0];
    let newCart = [...session.cart_json];
    const existingIdx = newCart.findIndex((l: any) => l.itemId === itemId);
    let qty = 1;
    if (existingIdx >= 0) {
      newCart[existingIdx].qty += 1;
      qty = newCart[existingIdx].qty;
    } else {
      newCart.push({ itemId, qty: 1, modifierIds: [] });
    }
    console.log(`[FSM:ITEM] Added ${item.name} x${qty} to cart. cartLen=${newCart.length}`);

    await sessionService.updateSession(session.id, { state: 'ordering', cart_json: newCart });
    // Button titles kept under 20 chars (Meta API hard limit)
    await provider.sendInteractiveButtons(from, MESSAGES.ADDED_TO_CART(qty, item.name, item.price_inr * qty), [
      { id: 'btn_view_cart', title: 'View Cart' },
      { id: 'btn_menu',     title: 'Add More Items' },
      { id: 'btn_checkout', title: 'Checkout' }
    ]);
    console.log(`[FSM:ITEM] Sent cart buttons — state=ordering`);
    return;
  }

  // --- ORDERING -> Add More ---
  if ((session.state === 'ordering' || session.state === 'checkout_confirm' || session.state === 'cart_review') && input === 'btn_menu') {
    console.log(`[FSM:ADDMORE] Returning to category browse`);
    await sessionService.updateSession(session.id, { state: 'browsing' });
    const catRes = await db.query(`SELECT id, name FROM menu_categories WHERE active = true ORDER BY sort_order`);
    const rows = catRes.rows.map(c => ({ id: `cat_${c.id}`, title: c.name.substring(0, 24) }));
    await provider.sendListMessage(from, MESSAGES.CATEGORY_PROMPT, 'View Menu', [
      { title: 'Categories', rows },
      { title: 'Options', rows: [
        { id: 'action_cart', title: '🛒 View My Cart' },
        { id: 'action_status', title: '📦 Track My Order' },
        { id: 'action_handoff', title: '👋 Talk to Staff' }
      ]}
    ]);
    return;
  }

  // --- LEGACY CART TRIGGER ---
  if (session.state === 'ordering' && (input === 'btn_view_cart' || input === 'btn_checkout')) {
    await sessionService.updateSession(session.id, { state: 'cart_review' });
    session.state = 'cart_review';
    input = '__enter_cart_review';
  }

  // --- CART REVIEW ---
  if (session.state === 'cart_review' && input === '__enter_cart_review') {
    if (!session.cart_json || session.cart_json.length === 0) {
      await provider.sendText(from, MESSAGES.CART_EMPTY);
      return;
    }

    console.log(`[FSM:CART] Building summary for ${session.cart_json.length} cart line(s)...`);
    let cartLines: string[] = [];
    let total = 0;
    let maxPrepTimeMin = 5;
    for (const line of session.cart_json) {
      const itemRes = await db.query(`SELECT name, price_inr, prep_time_min FROM menu_items WHERE id = $1`, [line.itemId]);
      if (itemRes.rows && itemRes.rows.length > 0) {
        const item = itemRes.rows[0];
        const lineTotal = item.price_inr * line.qty;
        total += lineTotal;
        if (item.prep_time_min > maxPrepTimeMin) maxPrepTimeMin = item.prep_time_min;
        cartLines.push(`• ${line.qty}x ${item.name} (Rs.${lineTotal})`);
      }
    }
    
    await provider.sendInteractiveButtons(from, MESSAGES.CART_REVIEW(cartLines, total, maxPrepTimeMin), [
      { id: 'btn_flow_checkout', title: 'Checkout' },
      { id: 'btn_menu', title: 'Add More Items' },
      { id: 'reset', title: 'Cancel Order' }
    ]);
    return;
  }

  // --- CART REVIEW -> CHECKOUT CONFIRM ---
  if (session.state === 'cart_review' && input === 'btn_flow_checkout') {
    await sessionService.updateSession(session.id, { state: 'checkout_confirm' });
    session.state = 'checkout_confirm';
    input = '__enter_checkout_confirm';
  }

  // --- CHECKOUT CONFIRM (Pre-Flow Fallback) ---
  if (session.state === 'checkout_confirm' && input === '__enter_checkout_confirm') {
    let cartLines: string[] = [];
    let total = 0;
    for (const line of session.cart_json || []) {
      const itemRes = await db.query(`SELECT name, price_inr FROM menu_items WHERE id = $1`, [line.itemId]);
      if (itemRes.rows && itemRes.rows.length > 0) {
        const item = itemRes.rows[0];
        const lineTotal = item.price_inr * line.qty;
        total += lineTotal;
        cartLines.push(`• ${line.qty}x ${item.name} (Rs.${lineTotal})`);
      }
    }

    await provider.sendInteractiveButtons(from, MESSAGES.CHECKOUT_PROMPT(cartLines, total), [
      { id: 'pay_counter', title: 'Pay at Counter' },
      { id: 'pay_online', title: 'Pay Online' }
    ]);
    return;
  }

  // --- CHECKOUT CONFIRM -> PLACE ORDER ---
  if (session.state === 'checkout_confirm' && (input === 'pay_counter' || input === 'pay_online' || input === 'btn_confirm_order')) {
    console.log(`[FSM:ORDER] Placing order for customerId=${session.customer_id} mode=${input}...`);
    if (await settingsService.isDigitalLanePaused()) {
      await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
      return;
    }

    try {
      const orderRes = await orderService.createOrder({
        customerId: session.customer_id,
        lines: session.cart_json || [],
        idempotencyKey: `order:${message.id}`
      });
      console.log(`[FSM:ORDER] Created orderCode=${orderRes.orderCode} total=Rs.${orderRes.pricedCart.total}`);

      await sessionService.updateSession(session.id, { state: 'idle', cart_json: [] });
      const itemNames = orderRes.pricedCart.lines.map((l: any) => `${l.qty}x ${l.itemName}`).join(', ');
      
      let paymentMode = input === 'pay_online' ? 'razorpay' : 'cash';
      // Legacy mapping
      if (input === 'btn_confirm_order') paymentMode = 'cash'; 

      if (paymentMode === 'razorpay' && razorpayService.isConfigured()) {
        console.log(`[FSM:ORDER] Creating Razorpay payment link...`);
        const plink = await razorpayService.createPaymentLink(
          orderRes.orderId, orderRes.orderCode, orderRes.pricedCart.total, from
        );
        await orderService.updatePaymentIntent(orderRes.orderId, plink.id, 'razorpay');
        await provider.sendText(from, 
          MESSAGES.ORDER_CONFIRMED_ONLINE(orderRes.orderCode, itemNames, orderRes.pricedCart.maxPrepTimeMin, plink.short_url)
        );
      } else {
        if (paymentMode === 'razorpay') {
          console.log(`[FSM:ORDER] Razorpay not configured but online selected, defaulting to counter`);
        }
        await orderService.updatePaymentIntent(orderRes.orderId, 'pay_at_counter', 'cash');
        await provider.sendText(from, 
          MESSAGES.ORDER_CONFIRMED_COUNTER(orderRes.orderCode, itemNames, orderRes.pricedCart.maxPrepTimeMin, orderRes.pricedCart.total)
        );
      }

      console.log(`[FSM:ORDER] Confirmation sent — state=idle`);
    } catch (err: any) {
      console.error(`[FSM:ORDER] Error:`, err.message);
      if (err.message === 'Digital ordering lane is currently paused.') {
        await provider.sendText(from, MESSAGES.DIGITAL_LANE_PAUSED);
      } else {
        await provider.sendText(from, MESSAGES.ORDER_ERROR(err.message));
      }
    }
    return;
  }

  // Catch-all — no handler matched
  console.log(`[FSM:UNHANDLED] state=${session.state} input="${input}" — sending unrecognized message`);
  await provider.sendText(from, MESSAGES.UNRECOGNIZED_INPUT);
}
