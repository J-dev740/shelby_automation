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
      html += `<div class="home__cart-wrapper">
        <div class="home__cart-title">Your Cart</div>
        <div class="home__cart">`;
      for (const item of cart) {
        html += `
          <div class="home__cart-item" data-item-id="${item.itemId}">
            <span class="home__cart-item-name">${item.name}</span>
            <span class="home__cart-item-price">₹${item.price_inr * item.qty}</span>
            <div class="qty-stepper">
              <button class="qty-stepper__btn" data-action="dec" data-id="${item.itemId}">${ICONS.minus}</button>
              <span class="qty-stepper__count">${item.qty}</span>
              <button class="qty-stepper__btn" data-action="inc" data-id="${item.itemId}">${ICONS.plus}</button>
            </div>
          </div>`;
      }
      html += `</div></div>`;
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
    const sipsHero = el.querySelector('#hero-sips');
    const bitesHero = el.querySelector('#hero-bites');

    sipsHero?.addEventListener('click', () => {
      store.drawerType = 'sips';
      store.drawerOpen = true;
    });
    bitesHero?.addEventListener('click', () => {
      store.drawerType = 'bites';
      store.drawerOpen = true;
    });

    // Swipe up on heroes to open
    [sipsHero, bitesHero].forEach(hero => {
      if (!hero) return;
      let startY = 0;
      hero.addEventListener('touchstart', (e: any) => {
        startY = e.touches[0].clientY;
      }, { passive: true });
      hero.addEventListener('touchmove', () => {
        // Just empty listener if needed, or remove it entirely
      }, { passive: true });
      hero.addEventListener('touchend', (e: any) => {
        const deltaY = e.changedTouches[0].clientY - startY;
        if (deltaY < -30) {
          if (e.cancelable) e.preventDefault(); // Prevent ghost clicks on the newly opened drawer
          store.drawerType = hero.id === 'hero-sips' ? 'sips' : 'bites';
          store.drawerOpen = true;
        }
      });
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

    // Swipe right to delete from cart
    el.querySelectorAll('.home__cart-item').forEach(item => {
      let startX = 0;
      let currentX = 0;
      const htmlItem = item as HTMLElement;
      htmlItem.addEventListener('touchstart', (e: any) => {
        startX = e.touches[0].clientX;
        htmlItem.style.transition = 'none';
      }, { passive: true });
      htmlItem.addEventListener('touchmove', (e: any) => {
        const deltaX = e.touches[0].clientX - startX;
        // Only allow swiping right (deltaX > 0)
        currentX = Math.max(0, deltaX);
        htmlItem.style.transform = `translateX(${currentX}px)`;
        htmlItem.style.opacity = String(1 - (currentX / 100));
      }, { passive: true });
      htmlItem.addEventListener('touchend', () => {
        htmlItem.style.transition = 'transform var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)';
        if (currentX > 80) {
          htmlItem.style.transform = `translateX(100px)`;
          htmlItem.style.opacity = '0';
          setTimeout(() => {
            import('../lib/store.js').then(m => m.removeFromCart(htmlItem.dataset.itemId!));
          }, 200);
        } else {
          htmlItem.style.transform = '';
          htmlItem.style.opacity = '1';
        }
        currentX = 0;
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
