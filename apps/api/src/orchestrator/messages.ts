export const MESSAGES = {
  RESET_SUCCESS: "Session reset. Type 'hi' to start a new order!",
  DIGITAL_LANE_PAUSED: "We're a bit slammed right now — please walk up to the window!",
  WELCOME: "Welcome to Shelby! 👋 Ready to grab a drink?",
  ITEM_UNAVAILABLE: "Sorry, that item is currently unavailable.",
  ADDED_TO_CART: (itemName: string) => `Added ${itemName}! Anything else?`,
  CART_EMPTY: "Your cart is empty! Type 'hi' to start ordering.",
  ORDER_CONFIRMED: (orderCode: string, itemNames: string, prepTimeMin: number, paymentLink?: string) => {
    if (paymentLink) {
      return `✅ Order Created! (Code: ${orderCode})\n\nYou ordered: ${itemNames}.\nIt'll take ~${prepTimeMin} mins.\n\nPlease pay online to confirm your order:\n💳 ${paymentLink}`;
    }
    return `✅ Order Confirmed! (Code: ${orderCode})\n\nYou ordered: ${itemNames}.\nIt'll be ready in ~${prepTimeMin} mins. Just pay at the counter when you pick it up!`;
  },
  PAYMENT_RECEIVED: (orderCode: string) => `✅ Payment received for Order ${orderCode}! Your order is now being prepared.`,
  ORDER_READY: (orderCode: string) => `🎉 Great news! Order ${orderCode} is ready. Please pick it up at the counter!`,
  ORDER_ERROR: (msg: string) => `Sorry, we couldn't process your order: ${msg}`,
  HANDOFF_ACTIVE: "I'm connecting you with the team — someone will reply here shortly. You can also walk up to the window anytime.",
  UNRECOGNIZED_INPUT: "I didn't quite catch that. Type 'hi' to restart!"
};
