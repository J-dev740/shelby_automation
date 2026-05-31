import { ICONS } from '../assets/icons.js';
import { store, subscribe, addToCart } from '../lib/store.js';
import type { MenuItem } from '../lib/store.js';

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
          <div class="item-card__icon">${type === 'sips' ? ICONS.coffee : ICONS.food}</div>
          <span class="item-card__name">${item.name}</span>
          <span class="item-card__price">₹${item.price_inr}</span>
          <button class="item-card__add" data-item-id="${item.id}" aria-label="Add ${item.name}">${ICONS.plus}</button>
        </div>
      `).join('')}
      ${items.length === 0 ? '<p style="padding: 2rem; color: var(--color-text-muted); text-align: center;">Menu is being updated ☕</p>' : ''}
    </div>
  `;

  // Bind toggle buttons
  drawerEl.querySelectorAll('.drawer__toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newType = (btn as HTMLElement).dataset.type as 'sips' | 'bites';
      if (newType !== store.drawerType) {
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
        // Bounce animation
        btn.classList.remove('added');
        void btn.offsetWidth; // Force reflow
        btn.classList.add('added');
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
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
