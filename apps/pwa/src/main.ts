import './styles/base.css';
import './styles/splash.css';
import './styles/home.css';
import './styles/drawer.css';
import './styles/checkout.css';
import { renderSplash } from './screens/splash.js';
import { renderHome } from './screens/home.js';
import { openDrawer } from './screens/menu-drawer.js';
import { openCheckout } from './screens/checkout.js';
import { openSideDrawer } from './components/side-drawer.js';
import { store, subscribe } from './lib/store.js';
import { api } from './lib/api.js';
import { save, load } from './lib/persist.js';

const app = document.getElementById('app')!;

// 1. Show splash
app.appendChild(renderSplash());

// 2. Mount home (behind splash)
const home = renderHome();
app.appendChild(home);

// 3. Restore persisted state
store.cart = load('cart', []);
store.phone = load('phone', null);

// 4. Fetch menu
async function loadMenu() {
  try {
    store.menuLoading = true;
    const menu = await api.getMenu();
    store.menu = { sips: menu.sips, bites: menu.bites };
    save('menu', store.menu);
    console.log(`[Shelby] Menu loaded: ${menu.sips.length} sips, ${menu.bites.length} bites`);
  } catch (err) {
    console.error('[Shelby] Failed to load menu:', err);
    // Fallback to cached menu
    const cached = load<typeof store.menu>('menu', null);
    if (cached) {
      store.menu = cached;
      console.log('[Shelby] Using cached menu');
    }
  } finally {
    store.menuLoading = false;
  }
}

// 5. Persist cart on changes
let lastCartJson = '';
setInterval(() => {
  const cartJson = JSON.stringify(store.cart);
  if (cartJson !== lastCartJson) {
    save('cart', store.cart);
    lastCartJson = cartJson;
  }
}, 500);

// 6. Poll active orders (every 15s) if phone is known
let pollTimer: ReturnType<typeof setInterval> | null = null;

function startOrderPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (!store.phone) return;

  const poll = async () => {
    if (!store.phone) return;
    try {
      const { orders } = await api.getActiveOrders(store.phone);
      store.activeOrders = orders;
    } catch (err) {
      console.error('[Shelby] Poll failed:', err);
    }
  };

  poll(); // Immediate first poll
  pollTimer = setInterval(poll, 15_000);
}

// Start polling if phone exists
if (store.phone) startOrderPolling();

// 7. Listen for store changes to open/close drawers
let prevDrawerOpen = false;
let prevSideDrawerOrder: string | null = null;

subscribe(() => {
  // Bottom drawer
  if (store.drawerOpen && !prevDrawerOpen) {
    openDrawer(store.drawerType);
  }
  prevDrawerOpen = store.drawerOpen;

  // Side drawer for order details
  const currentOrderId = store.sideDrawerOrder?.id || null;
  if (currentOrderId && currentOrderId !== prevSideDrawerOrder) {
    openSideDrawer(store.sideDrawerOrder!);
  }
  prevSideDrawerOrder = currentOrderId;
});

// 8. Listen for phone being set (after checkout)
window.addEventListener('phone-set', () => {
  save('phone', store.phone);
  startOrderPolling();
});

// 9. Navigation events
window.addEventListener('navigate', ((e: CustomEvent) => {
  const target = e.detail;
  if (target === 'checkout') {
    openCheckout();
  }
}) as EventListener);

// 10. Load menu
loadMenu();

// 11. Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // SW registration failed — not critical for MVP
  });
}

console.log('🚀 Shelby PWA initialized');
