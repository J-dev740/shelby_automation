import { ICONS } from '../assets/icons.js';
import { store, subscribe, addToCart } from '../lib/store.js';
import type { MenuItem } from '../lib/store.js';

/** Maps a menu item name to its unique sprite symbol ID */
function iconForItem(itemName: string): string {
  const ITEM_ICON_MAP: Record<string, string> = {
    'rose tea': 'icon-rose-tea',
    'classic cold coffee': 'icon-classic-cold-coffee',
    'masala tea': 'icon-masala-tea',
    'hazelnut cold coffee': 'icon-hazelnut-cold-coffee',
    'caramel cold coffee': 'icon-caramel-cold-coffee',
    'cold brew': 'icon-cold-brew',
    'spanish latte': 'icon-spanish-latte',
    'dalgona coffee': 'icon-dalgona-coffee',
    'lemon honey tea': 'icon-lemon-honey-tea',
    'espresso': 'icon-espresso',
    'cappuccino': 'icon-cappuccino',
    'flat white': 'icon-flat-white',
    'café latte': 'icon-cafe-latte',
    'cafe latte': 'icon-cafe-latte',
    'mocha': 'icon-mocha',
    'filter coffee': 'icon-filter-coffee',
    'masala chai': 'icon-masala-chai',
    'shelby signature coffee': 'icon-shelby-signature',
    'ginger lemon tea': 'icon-ginger-lemon-tea',
    'hazelnut coffee': 'icon-hazelnut-coffee',
    'matcha latte': 'icon-matcha-latte',
    'black tea': 'icon-black-tea',
    'black coffee': 'icon-black-coffee',
    'mango smoothie': 'icon-mango-smoothie',
    'mixed berry smoothie': 'icon-berry-smoothie',
    'banana peanut butter': 'icon-banana-pb',
    'hot chocolate': 'icon-hot-chocolate',
    'premium cold coffee': 'icon-premium-cold-coffee',
    'irish cold coffee': 'icon-irish-cold-coffee',
    'watermelon mojito': 'icon-watermelon-mojito',
    'extra espresso shot': 'icon-espresso-shot',
    'oat milk swap': 'icon-oat-milk',
    'flavour syrup': 'icon-flavour-syrup',
    'veg club sandwich': 'icon-veg-club',
    'paneer tikka sandwich': 'icon-paneer-tikka',
    'avocado toast': 'icon-avocado-toast',
    'banana walnut muffin': 'icon-banana-muffin',
    'chocolate brownie': 'icon-brownie',
    'butter croissant': 'icon-croissant',
  };
  const key = itemName.toLowerCase().trim();
  // Exact match first
  if (ITEM_ICON_MAP[key]) return ITEM_ICON_MAP[key];
  // Fuzzy match — check if item name contains any key
  for (const [k, v] of Object.entries(ITEM_ICON_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  // Fallback based on item name keywords
  const n = key;
  if (n.includes('cold') || n.includes('iced')) return 'icon-classic-cold-coffee';
  if (n.includes('tea') || n.includes('chai')) return 'icon-masala-tea';
  if (n.includes('coffee') || n.includes('latte') || n.includes('cappuccino')) return 'icon-espresso';
  if (n.includes('smooth')) return 'icon-mango-smoothie';
  if (n.includes('mojito') || n.includes('juice')) return 'icon-watermelon-mojito';
  if (n.includes('sandwich') || n.includes('toast')) return 'icon-veg-club';
  if (n.includes('muffin') || n.includes('cake')) return 'icon-banana-muffin';
  if (n.includes('brownie') || n.includes('chocolate')) return 'icon-brownie';
  if (n.includes('croissant')) return 'icon-croissant';
  return 'icon-espresso'; // ultimate fallback
}



let drawerEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let currentRenderedType: 'sips' | 'bites' | null = null;

export function openDrawer(type: 'sips' | 'bites') {
  if (drawerEl) return; // Already open

  store.drawerType = type;
  store.drawerOpen = true;

  // Overlay
  overlayEl = document.createElement('div');
  overlayEl.className = 'drawer-overlay';
  overlayEl.addEventListener('click', closeDrawer);
  
  let overlayStartY = 0;
  overlayEl.addEventListener('touchstart', (e: any) => {
    overlayStartY = e.touches[0].clientY;
  }, { passive: true });
  overlayEl.addEventListener('touchend', (e: any) => {
    const deltaY = e.changedTouches[0].clientY - overlayStartY;
    if (deltaY > 30) {
      closeDrawer();
    }
  });

  document.body.appendChild(overlayEl);

  // Drawer
  drawerEl = document.createElement('div');
  drawerEl.className = 'drawer';
  drawerEl.id = 'menu-drawer';

  renderDrawerContent();

  document.body.appendChild(drawerEl);

  // Handle swipe-down to close is now bound in renderDrawerContent

  // Subscribe to type changes
  unsubscribe = subscribe(() => {
    if (!store.drawerOpen) {
      closeDrawer();
      return;
    }
    if (store.drawerType !== currentRenderedType) {
      renderDrawerContent();
    }
  });
}

function renderDrawerContent() {
  if (!drawerEl || !store.menu) return;

  const type = store.drawerType;
  currentRenderedType = type;
  const items: MenuItem[] = type === 'sips' ? store.menu.sips : store.menu.bites;
  const title = type === 'sips' ? 'Sips' : 'Bites';

  drawerEl.innerHTML = `
    <div class="drawer__handle"><div class="drawer__handle-bar"></div></div>
    <div class="drawer__header">
      <span class="drawer__title">${title}</span>
      <div class="drawer__toggle">
        <button class="drawer__toggle-btn ${type === 'sips' ? 'active' : ''}" data-type="sips">
          ${ICONS.coffeeMini}
        </button>
        <button class="drawer__toggle-btn ${type === 'bites' ? 'active' : ''}" data-type="bites">
          ${ICONS.foodMini}
        </button>
      </div>
    </div>
    <div class="drawer__items">
      ${items.map(item => `
        <div class="item-card" data-item-id="${item.id}">
          <div class="item-card__icon">
            <svg viewBox="0 0 64 64" aria-hidden="true"><use href="/menu-sprite.svg#${iconForItem(item.name)}"></use></svg>
          </div>
          <span class="item-card__name">${item.name}</span>
          <span class="item-card__price">&#x20B9;${item.price_inr}</span>
          <button class="item-card__add" data-item-id="${item.id}" aria-label="Add ${item.name}">${ICONS.plus}</button>
        </div>
      `).join('')}
      ${items.length === 0 ? '<p style="padding: 2rem; color: var(--color-text-muted); text-align: center;">Menu is being updated &#x2615;</p>' : ''}
    </div>
  `;


  // Bind toggle buttons
  drawerEl.querySelectorAll('.drawer__toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(10);
      const newType = (btn as HTMLElement).dataset.type as 'sips' | 'bites';
      if (newType !== store.drawerType) {
        // Fade the title text out then back in
        const titleEl = drawerEl?.querySelector('.drawer__title') as HTMLElement | null;
        if (titleEl) {
          titleEl.style.transition = 'opacity 150ms ease';
          titleEl.style.opacity = '0';
          setTimeout(() => { titleEl.style.opacity = '1'; }, 160);
        }
        store.drawerType = newType;
      }
    });
  });

  // Bind add buttons and swipe up to add
  drawerEl.querySelectorAll('.item-card').forEach(card => {
    const btn = card.querySelector('.item-card__add') as HTMLElement;
    const itemId = (card as HTMLElement).dataset.itemId!;

    const triggerAdd = () => {
      const allItems = [...(store.menu?.sips || []), ...(store.menu?.bites || [])];
      const item = allItems.find(i => i.id === itemId);
      if (item) {
        addToCart(item);

        // 1. Ripple burst + green flash on the + button
        btn.classList.remove('added');
        void btn.offsetWidth; // Force reflow
        btn.classList.add('added');
        // Swap to checkmark while added class is active
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          btn.classList.remove('added');
          btn.innerHTML = originalHTML;
        }, 500);

        // 2. Warm glow pulse on the card itself
        const cardEl = card as HTMLElement;
        cardEl.classList.add('item-added');
        setTimeout(() => cardEl.classList.remove('item-added'), 400);
      }
    };

    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerAdd();
    });

    let startY = 0;
    let startX = 0;
    card.addEventListener('touchstart', (e: any) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    }, { passive: true });
    card.addEventListener('touchend', (e: any) => {
      const deltaY = e.changedTouches[0].clientY - startY;
      const deltaX = e.changedTouches[0].clientX - startX;
      // Must be a deliberate vertical swipe up, not a horizontal scroll
      if (deltaY < -40 && Math.abs(deltaY) > Math.abs(deltaX)) {
        triggerAdd();
      }
    });
  });

  // Re-bind handle swipe
  bindDrawerSwipe();
}

export function closeDrawer() {
  if (!drawerEl || !overlayEl) return;

  drawerEl.classList.add('closing');
  overlayEl.classList.add('closing');

  const cleanup = () => {
    drawerEl?.remove();
    overlayEl?.remove();
    drawerEl = null;
    overlayEl = null;
    currentRenderedType = null;
    store.drawerOpen = false;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  drawerEl.addEventListener('animationend', cleanup, { once: true });
}

function bindDrawerSwipe() {
  if (!drawerEl) return;

  let startY = 0;
  let startX = 0;
  let currentY = 0;
  let dragging = false;
  let isHorizontalScroll = false;

  drawerEl.addEventListener('touchstart', (e: any) => {
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    dragging = false;
    isHorizontalScroll = false;
    drawerEl!.style.transition = 'none';
  }, { passive: true });

  drawerEl.addEventListener('touchmove', (e: any) => {
    const deltaY = e.touches[0].clientY - startY;
    const deltaX = e.touches[0].clientX - startX;

    if (!dragging && !isHorizontalScroll) {
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isHorizontalScroll = true;
      } else if (deltaY > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
        dragging = true;
      }
    }

    if (dragging) {
      currentY = Math.max(0, deltaY);
      drawerEl!.style.transform = `translateY(${currentY}px)`;
    }
  }, { passive: true });

  drawerEl.addEventListener('touchend', () => {
    drawerEl!.style.transition = '';

    if (dragging) {
      // If dragged > 30% of drawer height, close
      const threshold = drawerEl!.offsetHeight * 0.3;
      if (currentY > threshold) {
        closeDrawer();
      } else {
        drawerEl!.style.transform = '';
      }
    }
    
    dragging = false;
    isHorizontalScroll = false;
    currentY = 0;
  });
}
