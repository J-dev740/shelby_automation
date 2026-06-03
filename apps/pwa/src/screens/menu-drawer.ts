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
// Subcategory filter state — resets when drawer type changes
let activeSubCategory: string | null = null;

export function openDrawer(type: 'sips' | 'bites') {
  if (drawerEl) return; // Already open

  store.drawerType = type;
  store.drawerOpen = true;
  activeSubCategory = null; // reset filter on fresh open

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

  // Subscribe to type changes
  unsubscribe = subscribe(() => {
    if (!store.drawerOpen) {
      closeDrawer();
      return;
    }
    if (store.drawerType !== currentRenderedType) {
      activeSubCategory = null; // reset filter on category switch
      renderDrawerContent();
    }
  });
}

function getSubCategories(items: MenuItem[]): string[] {
  const cats = new Set<string>();
  items.forEach(i => { if (i.category_name) cats.add(i.category_name); });
  return Array.from(cats);
}

function renderDrawerContent() {
  if (!drawerEl || !store.menu) return;

  const type = store.drawerType;
  currentRenderedType = type;
  const allItems: MenuItem[] = type === 'sips' ? store.menu.sips : store.menu.bites;
  const subCategories = getSubCategories(allItems);
  const hasFilter = subCategories.length > 1;

  // Filter items by active subcategory
  const items = activeSubCategory
    ? allItems.filter(i => i.category_name === activeSubCategory)
    : allItems;

  const title = type === 'sips' ? 'Sips' : 'Bites';
  const pillLabel = activeSubCategory || 'All';

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
    <div class="drawer__items" id="drawer-items">
      ${items.map(item => `
        <div class="item-card" data-item-id="${item.id}">
          <div class="item-card__icon">
            <svg viewBox="0 0 64 64" aria-hidden="true"><use href="#${iconForItem(item.name)}"></use></svg>
          </div>
          <div class="item-card__body">
            <span class="item-card__name">${item.name}</span>
            <span class="item-card__price">&#x20B9;${item.price_inr}</span>
            <button class="item-card__add" data-item-id="${item.id}" aria-label="Add ${item.name}">${ICONS.plus}</button>
          </div>
        </div>
      `).join('')}
      ${items.length === 0 ? '<p style="padding: 2rem; color: var(--color-text-muted); text-align: center;">No items in this category &#x2615;</p>' : ''}
    </div>
    ${hasFilter ? `
    <div class="drawer__filter-bar" id="drawer-filter-bar">
      <button class="drawer__filter-pill ${activeSubCategory ? 'has-filter' : ''}" id="drawer-filter-pill" aria-expanded="false">
        <span class="drawer__filter-pill__label">${pillLabel}</span>
        <span class="drawer__filter-pill__chevron">${ICONS.chevronDown}</span>
      </button>
      <div class="drawer__filter-chips" id="drawer-filter-chips" aria-hidden="true">
        <button class="drawer__filter-chip ${!activeSubCategory ? 'active' : ''}" data-cat="">All</button>
        ${subCategories.map(cat => `
          <button class="drawer__filter-chip ${activeSubCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
        `).join('')}
      </div>
    </div>` : ''}
  `;


  // Bind toggle buttons
  drawerEl.querySelectorAll('.drawer__toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(10);
      const newType = (btn as HTMLElement).dataset.type as 'sips' | 'bites';
      if (newType !== store.drawerType) {
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

  // Subcategory pill — toggle expand/collapse
  const pill = drawerEl.querySelector('#drawer-filter-pill') as HTMLButtonElement | null;
  const chips = drawerEl.querySelector('#drawer-filter-chips') as HTMLElement | null;
  const filterBar = drawerEl.querySelector('#drawer-filter-bar') as HTMLElement | null;

  if (pill && chips && filterBar) {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = filterBar.classList.toggle('expanded');
      pill.setAttribute('aria-expanded', String(expanded));
      chips.setAttribute('aria-hidden', String(!expanded));
    });

    chips.querySelectorAll('.drawer__filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = (chip as HTMLElement).dataset.cat || null;
        activeSubCategory = cat || null;
        filterBar.classList.remove('expanded');
        // Re-render with new filter
        renderDrawerContent();
      });
    });

    // Collapse pill when tapping outside filter bar
    drawerEl.addEventListener('click', (e) => {
      if (!filterBar.contains(e.target as Node)) {
        filterBar.classList.remove('expanded');
        pill.setAttribute('aria-expanded', 'false');
        chips.setAttribute('aria-hidden', 'true');
      }
    }, { capture: false });
  }

  // Bind add buttons and swipe up to add
  drawerEl.querySelectorAll('.item-card').forEach(card => {
    const btn = card.querySelector('.item-card__add') as HTMLElement;
    const itemId = (card as HTMLElement).dataset.itemId!;

    const triggerAdd = () => {
      const allMenuItems = [...(store.menu?.sips || []), ...(store.menu?.bites || [])];
      const item = allMenuItems.find(i => i.id === itemId);
      if (item) {
        addToCart(item);

        // 1. Ripple burst + green flash on the + button
        btn.classList.remove('added');
        void btn.offsetWidth; // Force reflow
        btn.classList.add('added');
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
