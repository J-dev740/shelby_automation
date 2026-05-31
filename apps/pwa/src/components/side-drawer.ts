import { ICONS } from '../assets/icons.js';
import { store } from '../lib/store.js';
import type { ActiveOrder } from '../lib/store.js';

let sideDrawerEl: HTMLElement | null = null;
let sideOverlayEl: HTMLElement | null = null;

export function openSideDrawer(order: ActiveOrder) {
  if (sideDrawerEl) closeSideDrawer();

  // Overlay
  sideOverlayEl = document.createElement('div');
  sideOverlayEl.className = 'side-drawer-overlay';
  sideOverlayEl.addEventListener('click', closeSideDrawer);
  document.body.appendChild(sideOverlayEl);

  // Drawer
  sideDrawerEl = document.createElement('div');
  sideDrawerEl.className = 'side-drawer';

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: '🕐 Placed', color: '#92400E', bg: '#FEF3C7' },
    accepted: { label: '✅ Accepted', color: '#1E40AF', bg: '#DBEAFE' },
    preparing: { label: '🍳 Preparing', color: '#92400E', bg: '#FDE68A' },
    ready: { label: '🎉 Ready!', color: '#065F46', bg: '#D1FAE5' },
    completed: { label: '✓ Done', color: '#6B5744', bg: '#F5E6D3' },
    cancelled: { label: '❌ Cancelled', color: '#C25B4E', bg: '#FEE2E2' },
  };

  const status = statusMap[order.state] || statusMap.new;
  const orderTime = new Date(order.created_at);
  const timeAgo = getTimeAgo(orderTime);

  sideDrawerEl.innerHTML = `
    <div class="side-drawer__code">#${order.order_code}</div>
    <div class="side-drawer__time">${timeAgo}</div>
    <div class="side-drawer__status" style="color: ${status.color}; background: ${status.bg};">
      ${status.label}
    </div>
    ${order.promised_eta_min ? `
      <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-lg);">
        <span style="width: 16px; height: 16px;">${ICONS.clock}</span>
        ~${order.promised_eta_min} min
      </div>
    ` : ''}
    <div class="side-drawer__items">
      ${order.items.map((item: any) => `
        <div class="side-drawer__item">
          <span>${item.qty}× ${item.name}</span>
        </div>
      `).join('')}
    </div>
    <div class="side-drawer__total">
      <span>Total</span>
      <span>₹${order.total_inr}</span>
    </div>
  `;

  document.body.appendChild(sideDrawerEl);

  // Swipe right to close
  bindSideSwipe();
}

export function closeSideDrawer() {
  if (!sideDrawerEl || !sideOverlayEl) return;

  sideDrawerEl.classList.add('closing');
  sideOverlayEl.classList.add('closing');

  const cleanup = () => {
    sideDrawerEl?.remove();
    sideOverlayEl?.remove();
    sideDrawerEl = null;
    sideOverlayEl = null;
    store.sideDrawerOrder = null;
  };

  sideDrawerEl.addEventListener('animationend', cleanup, { once: true });
}

function bindSideSwipe() {
  if (!sideDrawerEl) return;
  let startX = 0;
  let currentX = 0;

  sideDrawerEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    sideDrawerEl!.style.transition = 'none';
  }, { passive: true });

  sideDrawerEl.addEventListener('touchmove', (e) => {
    const deltaX = e.touches[0].clientX - startX;
    currentX = Math.max(0, deltaX);
    sideDrawerEl!.style.transform = `translateX(${currentX}px)`;
  }, { passive: true });

  sideDrawerEl.addEventListener('touchend', () => {
    sideDrawerEl!.style.transition = '';
    if (currentX > sideDrawerEl!.offsetWidth * 0.4) {
      closeSideDrawer();
    } else {
      sideDrawerEl!.style.transform = '';
    }
    currentX = 0;
  });
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}
