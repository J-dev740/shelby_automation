import { ICONS } from '../assets/icons.js';
import { store, subscribe, getCartTotal, getCartCount, updateQty } from '../lib/store.js';

export function renderHome(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'home';
  el.id = 'home';

  function render() {
    const { activeOrders, cart } = store;
    const hasOrders = activeOrders.length > 0;
    const hasCart = cart.length > 0;

    let html = '';

    // 1. Active order cards (topmost)
    if (hasOrders) {
      html += `<div class="home__orders">`;
      for (const order of activeOrders) {
        const itemSummary = order.items.map((i: any) => `${i.qty}× ${i.name}`).join(', ');
        const statusClass = `order-card__status--${order.state}`;
        html += `
          <div class="order-card touchable" data-order-id="${order.id}">
            <div class="order-card__left">
              <span class="order-card__code">#${order.order_code}</span>
              <span class="order-card__items">${itemSummary}</span>
            </div>
            <span class="order-card__status ${statusClass}">${order.state}</span>
            <span class="order-card__chevron">${ICONS.chevronRight}</span>
          </div>`;
      }
      html += `</div>`;
    }

    // 2. Cart component (above heroes)
    if (hasCart) {
      html += `<div class="home__cart">
        <div class="home__cart-title">Your Cart</div>`;
      for (const item of cart) {
        html += `
          <div class="home__cart-item" data-item-id="${item.itemId}">
            <span class="home__cart-item-name">${item.name}</span>
            <div class="qty-stepper">
              <button class="qty-stepper__btn" data-action="dec" data-id="${item.itemId}">${ICONS.minus}</button>
              <span class="qty-stepper__count">${item.qty}</span>
              <button class="qty-stepper__btn" data-action="inc" data-id="${item.itemId}">${ICONS.plus}</button>
            </div>
            <span class="home__cart-item-price">₹${item.price_inr * item.qty}</span>
          </div>`;
      }
      html += `</div>`;
    }

    // 3. Sips & Bites heroes (always present)
    html += `
      <div class="home__heroes">
        <div class="hero-card touchable" id="hero-sips">
          <div class="hero-card__icon">${ICONS.coffee}</div>
          <span class="hero-card__label">Sips</span>
        </div>
        <div class="hero-card touchable" id="hero-bites">
          <div class="hero-card__icon">${ICONS.food}</div>
          <span class="hero-card__label">Bites</span>
        </div>
      </div>`;

    el.innerHTML = html;

    // 4. Order confirmation bar (if cart has items) — appended to body, not inside .home
    renderConfirmationBar(hasCart);

    // Bind events
    bindEvents();
  }

  function bindEvents() {
    // Hero taps → open drawer
    el.querySelector('#hero-sips')?.addEventListener('click', () => {
      store.drawerType = 'sips';
      store.drawerOpen = true;
    });
    el.querySelector('#hero-bites')?.addEventListener('click', () => {
      store.drawerType = 'bites';
      store.drawerOpen = true;
    });

    // Qty stepper buttons
    el.querySelectorAll('.qty-stepper__btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const id = target.dataset.id!;
        const action = target.dataset.action!;
        if (action === 'inc') updateQty(id, 1);
        else updateQty(id, -1);
      });
    });

    // Order card taps → side drawer
    el.querySelectorAll('.order-card').forEach(card => {
      card.addEventListener('click', () => {
        const orderId = (card as HTMLElement).dataset.orderId;
        const order = store.activeOrders.find(o => o.id === orderId);
        if (order) {
          store.sideDrawerOrder = order;
        }
      });
    });
  }

  // Subscribe to store changes
  subscribe(render);
  render();

  return el;
}

function renderConfirmationBar(hasCart: boolean) {
  let bar = document.getElementById('confirmation-bar');
  if (!hasCart) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'confirmation-bar';
    bar.className = 'confirmation-bar';
    document.body.appendChild(bar);
  }

  const total = getCartTotal();
  const count = getCartCount();

  bar.innerHTML = `
    <div class="confirmation-bar__summary">
      <span class="confirmation-bar__count">${count} item${count > 1 ? 's' : ''}</span>
      <span class="confirmation-bar__total">₹${total}</span>
    </div>
    <div class="confirmation-bar__track">
      <div class="confirmation-bar__slider" id="slider-thumb">${ICONS.chevronRight}</div>
      <div class="confirmation-bar__text">Slide to order →</div>
    </div>
  `;

  // Bind slide gesture
  bindSlideGesture(bar);
}

function bindSlideGesture(bar: HTMLElement) {
  const thumb = bar.querySelector('#slider-thumb') as HTMLElement;
  const track = bar.querySelector('.confirmation-bar__track') as HTMLElement;
  if (!thumb || !track) return;

  let startX = 0;
  let currentX = 0;
  let trackWidth = 0;

  thumb.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    trackWidth = track.offsetWidth - thumb.offsetWidth - 8;
    thumb.style.transition = 'none';
  }, { passive: true });

  thumb.addEventListener('touchmove', (e) => {
    const deltaX = e.touches[0].clientX - startX;
    currentX = Math.max(0, Math.min(deltaX, trackWidth));
    thumb.style.transform = `translateX(${currentX}px)`;
  }, { passive: true });

  thumb.addEventListener('touchend', () => {
    const threshold = trackWidth * 0.7;
    thumb.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    if (currentX >= threshold) {
      // Confirmed! Navigate to checkout
      thumb.style.transform = `translateX(${trackWidth}px)`;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'checkout' }));
      }, 200);
    } else {
      // Snap back
      thumb.style.transform = 'translateX(0)';
    }
    currentX = 0;
  });
}
