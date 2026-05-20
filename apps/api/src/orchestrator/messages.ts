export const MESSAGES = {
  RESET_SUCCESS: "Session reset. Type 'hi' to start a new order!",
  DIGITAL_LANE_PAUSED: "We're a bit slammed right now — please walk up to the window!",
  WELCOME: "Welcome to Shelby! 👋 Ready to grab a drink?",
  ITEM_UNAVAILABLE: "Sorry, that item is currently unavailable.",
  ADDED_TO_CART: (itemName: string) => `Added ${itemName}! Anything else?`,
  CART_EMPTY: "Your cart is empty! Type 'hi' to start ordering.",
  ORDER_CONFIRMED: (orderCode: string, itemNames: string, prepTimeMin: number) => 
    `✅ Order Confirmed! (Code: ${orderCode})\n\nYou ordered: ${itemNames}.\nIt'll be ready in ~${prepTimeMin} mins. Just pay at the counter when you pick it up!`,
  ORDER_ERROR: (msg: string) => `Sorry, we couldn't process your order: ${msg}`,
  HANDOFF_ACTIVE: "I'm connecting you with the team — someone will reply here shortly. You can also walk up to the window anytime.",
  UNRECOGNIZED_INPUT: "I didn't quite catch that. Type 'hi' to restart!"
};
