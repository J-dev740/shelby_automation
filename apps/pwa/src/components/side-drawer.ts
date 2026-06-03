import { ICONS } from '../assets/icons.js';
import { store } from '../lib/store.js';
import type { ActiveOrder } from '../lib/store.js';

let sideDrawerEl: HTMLElement | null = null;
let sideOverlayEl: HTMLElement | null = null;

// ── Timeline config ──────────────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { id: 'new',       label: 'Placed',    color: '#E53E3E' },
  { id: 'accepted',  label: 'Accepted',  color: '#DD6B20' },
  { id: 'preparing', label: 'Preparing', color: '#D69E2E' },
  { id: 'ready',     label: 'Ready!',    color: '#38A169' },
];
const STATE_STEP: Record<string, number> = {
  new: 0, accepted: 1, preparing: 2, ready: 3, completed: 3,
};

function buildTimeline(state: string): string {
  if (state === 'cancelled') {
    return `<div class="order-timeline order-timeline--cancelled">
      <div class="order-timeline__cancelled-icon">✕</div>
      <span class="order-timeline__cancelled-label">Cancelled</span>
    </div>`;
  }

  const currentIdx = STATE_STEP[state] ?? 0;

  return `<div class="order-timeline">
    ${TIMELINE_STEPS.map((step, i) => {
      const isComplete = i < currentIdx;
      const isActive   = i === currentIdx;
      const stateClass = isComplete ? 'complete' : isActive ? 'active' : 'pending';
      const nextColor  = TIMELINE_STEPS[i + 1]?.color ?? step.color;
      const isLast     = i === TIMELINE_STEPS.length - 1;

      return `<div class="order-timeline__step ${stateClass}"
                   style="--step-color:${step.color}; --next-color:${nextColor}">
        <span class="order-timeline__label">${step.label}</span>
        <div class="order-timeline__node">
          <div class="order-timeline__dot"></div>
          ${!isLast ? '<div class="order-timeline__line"></div>' : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

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

  const orderTime = new Date(order.created_at);
  const timeAgo = getTimeAgo(orderTime);

  sideDrawerEl.innerHTML = `
    <div class="side-drawer__header-cell">
      <div class="side-drawer__code">#${order.order_code}</div>
      <div class="side-drawer__time">${timeAgo}</div>
    </div>
    <div class="side-drawer__body">
      <div class="side-drawer__left">
        ${order.promised_eta_min ? `
          <div class="side-drawer__eta">
            <span class="side-drawer__eta-icon">${ICONS.clock}</span>~${order.promised_eta_min} min
          </div>` : ''}
        <div class="side-drawer__items">
          ${order.items.map((item: any) => `
            <div class="side-drawer__item">
              <span>${item.qty}× ${item.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ${buildTimeline(order.state)}
    </div>
    <div class="side-drawer__total">
      <span>Total</span>
      <span>&#x20B9;${order.total_inr}</span>
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
