export const MESSAGES = {
  // --- EXISTING TEMPLATES (Kept for backwards compatibility during migration) ---
  RESET_SUCCESS: "🔄 Session reset. Type 'hi' to start a new order!",
  DIGITAL_LANE_PAUSED: "🚦 We're a bit slammed right now — please walk up to the window to order!",
  WELCOME: "Hey there! Welcome to Shelby 👋 Let's get you something good.",
  CATEGORY_PROMPT: "What are you in the mood for?",
  ITEM_PROMPT: "Great choice. Pick your poison:",
  ITEM_UNAVAILABLE: "Sorry, that item is currently unavailable.",
  ADDED_TO_CART: (qty: number, itemName: string, price: number) => `🛒 Added ${qty}x ${itemName} (₹${price}) to your cart!`,
  CART_EMPTY: "Your cart is empty! Type 'hi' to start ordering.",
  CHECKOUT_CONFIRM: (items: string[], total: number) => `📝 *Your Cart*\n\n${items.join('\n')}\n\n*Total: ₹${total}*\n\nReady to place this order?`,
  ORDER_CONFIRMED: (orderCode: string, itemNames: string, prepTimeMin: number, paymentLink?: string) => {
    if (paymentLink) {
      return `✅ *Order Confirmed! (Code: ${orderCode})*\n\nYou ordered: ${itemNames}.\nIt'll take ~${prepTimeMin} mins.\n\nPlease pay online to complete your order:\n💳 ${paymentLink}`;
    }
    return `✅ *Order Confirmed! (Code: ${orderCode})*\n\nYou ordered: ${itemNames}.\nIt'll be ready in ~${prepTimeMin} mins.\n\nJust pay at the counter when you pick it up!`;
  },
  PAYMENT_RECEIVED: (orderCode: string) => `✅ Payment received for Order ${orderCode}! Your order is now being prepared.`,
  ORDER_READY: (orderCode: string) => `🎉 Great news! Order ${orderCode} is ready.\n\nPlease pick it up at the counter!`,
  ORDER_ERROR: (msg: string) => `Sorry, we couldn't process your order: ${msg}`,
  HANDOFF_ACTIVE: "I'm connecting you with the team — someone will reply here shortly. You can also walk up to the window anytime.",
  UNRECOGNIZED_INPUT: "I didn't quite catch that. Type 'hi' to restart!",
  NOT_IMPLEMENTED: "This feature is coming soon!",

  // --- NEW TEMPLATES (For Flows-First Architecture) ---
  FLOW_PROMPT: (categoryName: string) => `Set quantities for what you want in ${categoryName} and add everything to your cart in one go!`,
  CART_REVIEW: (items: string[], total: number, etaMin: number) => `🛒 *Your Cart*\n\n${items.length ? items.join('\n') : "Empty"}\n─────────────────────\n*Total: ₹${total}*\n⏱️ Ready in ~${etaMin} mins`,
  CHECKOUT_PROMPT: (items: string[], total: number) => `📝 *Order Summary*\n\n${items.length ? items.join('\n') : "Empty"}\n─────────────────────\n*Total: ₹${total}*\n\nHow would you like to pay?`,
  ORDER_CONFIRMED_COUNTER: (orderCode: string, items: string, eta: number, total: number) => `✅ *Order Confirmed! (Code: ${orderCode})*\n\nItems: ${items}\nTotal: ₹${total}\n\nIt'll be ready in ~${eta} mins.\n\nJust pay at the counter when you pick it up!`,
  ORDER_CONFIRMED_ONLINE: (orderCode: string, items: string, eta: number, paymentLink: string) => `✅ *Order Confirmed! (Code: ${orderCode})*\n\nItems: ${items}\nIt'll take ~${eta} mins.\n\nPlease pay online to complete your order:\n💳 ${paymentLink}`,
  ORDER_STATUS: (orderCode: string, state: string, timeAgo: string, items: string, total: number) => `📦 *Your Last Order — #${orderCode}*\n\nStatus: ${state}\nPlaced: ${timeAgo}\nItems: ${items}\nTotal: ₹${total}\n\nWe'll message you when it's ready!`,
  ORDER_NOT_FOUND: "You don't have any recent orders. Type 'hi' to start ordering!",
  FLOW_ACTIVE_HINT: "You have an order form open — finish it above, or type 'cancel' to start over",
  NOTHING_SELECTED: "No items selected — pick a category to browse!",
  ITEMS_UNAVAILABLE_REMOVED: "⚠️ Some items in your cart became unavailable and were removed. Please review your updated cart."
};
