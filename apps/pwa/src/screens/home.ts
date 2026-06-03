import { ICONS } from '../assets/icons.js';
import { store, subscribe, getCartTotal, getCartCount, updateQty } from '../lib/store.js';

export function renderHome(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'home';
  el.id = 'home';

  // ── Persistent hero section ──────────────────────────────────────────────
  // Built ONCE and re-appended after each dynamic re-render.
  // This prevents CSS animations from restarting when the drawer opens/closes.
  const hintSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 4 18 9"/></svg>`;
  const heroesEl = document.createElement('div');
  heroesEl.className = 'home__heroes';
  heroesEl.innerHTML = `
    <div class="hero-card touchable" id="hero-sips" role="button" aria-label="Browse Sips menu" tabindex="0">
      <div class="hero-card__icon">${ICONS.coffee}</div>
      <span class="hero-card__label">Sips</span>
      <div class="hero-card__hint" aria-hidden="true">${hintSVG}${hintSVG}</div>
    </div>
    <div class="hero-card touchable" id="hero-bites" role="button" aria-label="Browse Bites menu" tabindex="0">
      <div class="hero-card__icon">${ICONS.food}</div>
      <span class="hero-card__label">Bites</span>
      <div class="hero-card__hint" aria-hidden="true">${hintSVG}${hintSVG}</div>
    </div>`;

  // Bind hero interactions once (heroes are never re-created)
  bindHeroEvents(heroesEl, el);

  // ── Memoized render key ──────────────────────────────────────────────────
  // Only the dynamic sections (orders + cart) need innerHTML updates.
  // drawerOpen / drawerType / menuLoading changes must NOT trigger a re-render.
  let lastRenderKey = '';

  function render() {
    const { activeOrders, cart } = store;

    // Stable key: only re-render when cart or orders actually change
    const renderKey = JSON.stringify({ cart, orders: activeOrders });
    if (renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;

    const hasOrders = activeOrders.length > 0;
    const hasCart   = cart.length > 0;

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
            <div class="order-card__status-cell">
              <span class="order-card__status ${statusClass}">${order.state}</span>
              <span class="order-card__chevron">${ICONS.chevronRight}</span>
            </div>
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
            <div class="home__cart-item-delete-bg" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Remove
            </div>
            <span class="home__cart-item-name">${item.name}</span>
            <div class="home__cart-item__right">
              <span class="home__cart-item-price">&#x20B9;${item.price_inr * item.qty}</span>
              <div class="qty-stepper">
                <button class="qty-stepper__btn" data-action="dec" data-id="${item.itemId}">${ICONS.minus}</button>
                <span class="qty-stepper__count">${item.qty}</span>
                <button class="qty-stepper__btn" data-action="inc" data-id="${item.itemId}">${ICONS.plus}</button>
              </div>
            </div>
          </div>`;
      }
      html += `</div></div>`;
    }

    // Inject dynamic sections (orders + cart only — heroes are NOT in this string)
    el.innerHTML = html;

    // Re-append the persistent heroes node (it was detached by innerHTML = ...)
    el.appendChild(heroesEl);

    // has-cart class
    el.classList.toggle('has-cart', hasCart);

    // 3. Order confirmation bar (appended to body)
    renderConfirmationBar(hasCart);

    // Bind dynamic section events (cart swipe, qty steppers, order cards)
    bindDynamicEvents(el);
  }

  // Subscribe to store changes
  subscribe(render);
  render();

  return el;
}

// ── bindHeroEvents: wired ONCE to the persistent heroesEl node ──────────────
function bindHeroEvents(heroesEl: HTMLElement, _homeEl: HTMLElement) {
  const HINT_KEY = 'shelby_hero_hint_done';

  function dismissHint() {
    heroesEl.querySelectorAll('.hero-card').forEach(c => c.classList.add('hint-done'));
    sessionStorage.setItem(HINT_KEY, '1');
  }

  function spawnRipple(hero: HTMLElement, clientX: number, clientY: number) {
    const rect = hero.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 0.6;
    const ripple = document.createElement('div');
    ripple.className = 'hero-card__ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${clientX - rect.left - size / 2}px;top:${clientY - rect.top - size / 2}px;`;
    hero.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  // Apply hint-done if already dismissed this session
  if (sessionStorage.getItem(HINT_KEY) === '1') {
    heroesEl.querySelectorAll('.hero-card').forEach(c => c.classList.add('hint-done'));
  }

  heroesEl.querySelectorAll<HTMLElement>('.hero-card').forEach(hero => {
    const type: 'sips' | 'bites' = hero.id === 'hero-sips' ? 'sips' : 'bites';
    let startY = 0;
    let startX = 0;
    let dragging = false;

    function openDrawer() {
      store.drawerType = type;
      store.drawerOpen = true;
    }

    hero.addEventListener('click', (e) => {
      spawnRipple(hero, e.clientX, e.clientY);
      dismissHint();
      openDrawer();
    });

    hero.addEventListener('touchstart', (e: any) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      dragging = false;
      hero.classList.add('pressing');
      spawnRipple(hero, e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    hero.addEventListener('touchmove', (e: any) => {
      const deltaY = e.touches[0].clientY - startY;
      const deltaX = Math.abs(e.touches[0].clientX - startX);
      if (deltaY < -8 && deltaX < 30) {
        dragging = true;
        hero.classList.remove('pressing');
        hero.classList.add('swiping-up');
        const lift = Math.min(28, Math.abs(deltaY) * 0.55);
        hero.style.transform = `translateY(-${lift}px) scale(${1 + lift * 0.002})`;
      }
    }, { passive: true });

    hero.addEventListener('touchend', (e: any) => {
      const deltaY = e.changedTouches[0].clientY - startY;
      hero.classList.remove('pressing', 'swiping-up');
      hero.style.transform = '';
      if (deltaY < -30) {
        dismissHint();
        if (e.cancelable) e.preventDefault();
        openDrawer();
      } else if (!dragging) {
        dismissHint();
      }
      dragging = false;
    });

    hero.addEventListener('touchcancel', () => {
      hero.classList.remove('pressing', 'swiping-up');
      hero.style.transform = '';
      dragging = false;
    });
  });
}

// ── bindDynamicEvents: wired on each render to cart/order nodes ──────────────
function bindDynamicEvents(el: HTMLElement) {
  // Qty stepper buttons
  el.querySelectorAll('.qty-stepper__btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const id = target.dataset.id!;
      const action = target.dataset.action!;
      if (action === 'inc') updateQty(id, 1);
      else updateQty(id, -1);
      const stepper = target.closest('.qty-stepper');
      const countEl = stepper?.querySelector('.qty-stepper__count') as HTMLElement | null;
      if (countEl) {
        countEl.classList.remove('qty-pop');
        void countEl.offsetWidth;
        countEl.classList.add('qty-pop');
        countEl.addEventListener('animationend', () => countEl.classList.remove('qty-pop'), { once: true });
      }
    });
  });

  // Order card taps → side drawer
  el.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', () => {
      const orderId = (card as HTMLElement).dataset.orderId;
      const order = store.activeOrders.find(o => o.id === orderId);
      if (order) store.sideDrawerOrder = order;
    });
  });

  // Swipe right to delete from cart
  el.querySelectorAll('.home__cart-item').forEach(item => {
    let startX = 0;
    let currentX = 0;
    let didCrossThreshold = false;
    const htmlItem = item as HTMLElement;
    const deleteBg = htmlItem.querySelector('.home__cart-item-delete-bg') as HTMLElement | null;

    htmlItem.addEventListener('touchstart', (e: any) => {
      startX = e.touches[0].clientX;
      currentX = 0;
      didCrossThreshold = false;
      htmlItem.style.transition = 'none';
      if (deleteBg) deleteBg.classList.remove('at-threshold');
    }, { passive: true });

    htmlItem.addEventListener('touchmove', (e: any) => {
      const deltaX = e.touches[0].clientX - startX;
      currentX = Math.max(0, deltaX);
      htmlItem.style.transform = `translateX(${currentX}px)`;
      htmlItem.style.opacity = String(Math.max(0.3, 1 - (currentX / 120)));
      if (deleteBg) {
        deleteBg.style.opacity = String(Math.min(1, currentX / 80));
        if (currentX >= 80 && !didCrossThreshold) {
          didCrossThreshold = true;
          deleteBg.classList.add('at-threshold');
          if (navigator.vibrate) navigator.vibrate(12);
        } else if (currentX < 80 && didCrossThreshold) {
          didCrossThreshold = false;
          deleteBg.classList.remove('at-threshold');
        }
      }
    }, { passive: true });

    htmlItem.addEventListener('touchend', () => {
      if (currentX > 80) {
        htmlItem.style.transition = '';
        htmlItem.style.transform = '';
        htmlItem.style.opacity = '';
        htmlItem.classList.add('collapsing');
        if (navigator.vibrate) navigator.vibrate(20);
        setTimeout(() => {
          import('../lib/store.js').then(m => m.removeFromCart(htmlItem.dataset.itemId!));
        }, 240);
      } else {
        htmlItem.style.transition = 'transform var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)';
        htmlItem.style.transform = '';
        htmlItem.style.opacity = '1';
        if (deleteBg) {
          deleteBg.style.opacity = '0';
          deleteBg.classList.remove('at-threshold');
        }
      }
      currentX = 0;
    });
  });
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
      <div class="confirmation-bar__text">
        <span>← Empty</span>
        <span>Order →</span>
      </div>
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
  let halfTrack = 0;

  thumb.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    halfTrack = (track.offsetWidth - thumb.offsetWidth) / 2 - 4;
    thumb.style.transition = 'none';
  }, { passive: true });

  thumb.addEventListener('touchmove', (e) => {
    const deltaX = e.touches[0].clientX - startX;
    currentX = Math.max(-halfTrack, Math.min(deltaX, halfTrack));
    thumb.style.transform = `translate(calc(-50% + ${currentX}px), 0)`;
    
    // Update icon direction based on swipe
    if (currentX < 0 && thumb.innerHTML !== '✕') {
      thumb.innerHTML = '✕';
    } else if (currentX >= 0 && thumb.innerHTML !== ICONS.chevronRight) {
      thumb.innerHTML = ICONS.chevronRight;
    }
  }, { passive: true });

  thumb.addEventListener('touchend', () => {
    const threshold = halfTrack * 0.6;
    thumb.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    if (currentX >= threshold) {
      // Confirmed! Navigate to checkout
      thumb.style.transform = `translate(calc(-50% + ${halfTrack}px), 0)`;
      thumb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      if (navigator.vibrate) navigator.vibrate(20);
      // Flash track green + update label
      const track = bar.querySelector('.confirmation-bar__track') as HTMLElement;
      const textSpans = bar.querySelectorAll('.confirmation-bar__text span');
      track?.classList.add('track-confirmed');
      if (textSpans[1]) (textSpans[1] as HTMLElement).textContent = '✓ Confirmed!';
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'checkout' }));
        // Reset slider when navigating back
        setTimeout(() => {
          thumb.style.transform = 'translate(-50%, 0)';
          thumb.innerHTML = ICONS.chevronRight;
          track?.classList.remove('track-confirmed');
          if (textSpans[1]) (textSpans[1] as HTMLElement).textContent = 'Order →';
          currentX = 0;
        }, 300);
      }, 200);
    } else if (currentX <= -threshold) {
      // Empty cart!
      thumb.style.transform = `translate(calc(-50% - ${halfTrack}px), 0)`;
      thumb.innerHTML = '✕';
      if (navigator.vibrate) navigator.vibrate(20);
      // Flash track red + update label
      const track = bar.querySelector('.confirmation-bar__track') as HTMLElement;
      const textSpans = bar.querySelectorAll('.confirmation-bar__text span');
      track?.classList.add('track-cleared');
      if (textSpans[0]) (textSpans[0] as HTMLElement).textContent = 'Cleared';
      setTimeout(() => {
        import('../lib/store.js').then(m => m.clearCart());
      }, 200);
    } else {
      // Snap back
      thumb.style.transform = 'translate(-50%, 0)';
      thumb.innerHTML = ICONS.chevronRight;
    }
    currentX = 0;
  });
}
