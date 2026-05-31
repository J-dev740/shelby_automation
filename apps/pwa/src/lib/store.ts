export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price_inr: number;
  prep_time_min: number;
  category_name: string;
}

export interface CartItem {
  itemId: string;
  name: string;
  price_inr: number;
  qty: number;
}

export interface ActiveOrder {
  id: string;
  order_code: string;
  state: string;
  total_inr: number;
  created_at: string;
  promised_eta_min: number;
  items: { qty: number; name: string }[];
}

export interface AppState {
  menu: { sips: MenuItem[]; bites: MenuItem[] } | null;
  cart: CartItem[];
  activeOrders: ActiveOrder[];
  phone: string | null;
  menuLoading: boolean;
  drawerOpen: boolean;
  drawerType: 'sips' | 'bites';
  sideDrawerOrder: ActiveOrder | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const initialState: AppState = {
  menu: null,
  cart: [],
  activeOrders: [],
  phone: null,
  menuLoading: true,
  drawerOpen: false,
  drawerType: 'sips',
  sideDrawerOrder: null,
};

export const store: AppState = new Proxy({ ...initialState }, {
  set(target, prop, value) {
    (target as any)[prop] = value;
    notify();
    return true;
  },
});

function notify() {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.error('Store listener error:', e); }
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Cart helpers
export function addToCart(item: MenuItem) {
  const existing = store.cart.find(c => c.itemId === item.id);
  if (existing) {
    existing.qty = Math.min(existing.qty + 1, 20);
  } else {
    store.cart.push({
      itemId: item.id,
      name: item.name,
      price_inr: item.price_inr,
      qty: 1,
    });
  }
  store.cart = [...store.cart]; // Trigger proxy
}

export function updateQty(itemId: string, delta: number) {
  const item = store.cart.find(c => c.itemId === itemId);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    removeFromCart(itemId);
  } else {
    item.qty = Math.min(newQty, 20);
    store.cart = [...store.cart];
  }
}

export function removeFromCart(itemId: string) {
  store.cart = store.cart.filter(c => c.itemId !== itemId);
}

export function clearCart() {
  store.cart = [];
}

export function getCartTotal(): number {
  return store.cart.reduce((sum, item) => sum + item.price_inr * item.qty, 0);
}

export function getCartCount(): number {
  return store.cart.reduce((sum, item) => sum + item.qty, 0);
}
