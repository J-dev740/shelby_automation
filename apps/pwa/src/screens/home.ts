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
            <div class="home__cart-item-delete-bg" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Remove
            </div>
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

    // Hint SVG chevron (used twice for bobbing depth effect)
    const hintSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 4 18 9"/></svg>`;

    // 3. Sips & Bites heroes (always present)
    html += `
      <div class="home__heroes">
        <div class="hero-card touchable" id="hero-sips" role="button" aria-label="Browse Sips menu" tabindex="0">
          <div class="hero-card__icon">${ICONS.coffee}</div>
          <span class="hero-card__label">Sips</span>
          <div class="hero-card__hint" aria-hidden="true">${hintSVG}${hintSVG}</div>
        </div>
        <div class="hero-card touchable" id="hero-bites" role="button" aria-label="Browse Bites menu" tabindex="0">
          <div class="hero-card__icon">${ICONS.food}</div>
          <span class="hero-card__label">Bites</span>
          <div class="hero-card__hint" aria-hidden="true">${hintSVG}${hintSVG}</div>
        </div>
      </div>`;

    el.innerHTML = html;
    
    // Add dynamic padding class
    if (hasCart) {
      el.classList.add('has-cart');
    } else {
      el.classList.remove('has-cart');
    }

    // 4. Order confirmation bar (if cart has items) — appended to body, not inside .home
    renderConfirmationBar(hasCart);

    // Bind events
    bindEvents();
  }

  function bindEvents() {
    // Hero taps → open drawer
    const sipsHero = el.querySelector('#hero-sips') as HTMLElement | null;
    const bitesHero = el.querySelector('#hero-bites') as HTMLElement | null;

    // Helpers
    const HINT_KEY = 'shelby_hero_hint_done';
    const hintDone = sessionStorage.getItem(HINT_KEY) === '1';

    function dismissHint(hero: HTMLElement) {
      hero.classList.add('hint-done');
      sessionStorage.setItem(HINT_KEY, '1');
      // Also dismiss the other card
      el.querySelectorAll('.hero-card').forEach(c => c.classList.add('hint-done'));
    }

    function spawnRipple(hero: HTMLElement, touch: Touch | MouseEvent) {
      const rect = hero.getBoundingClientRect();
      const x = ('clientX' in touch ? touch.clientX : (touch as Touch).clientX) - rect.left;
      const y = ('clientY' in touch ? touch.clientY : (touch as Touch).clientY) - rect.top;
      const size = Math.max(rect.width, rect.height) * 0.6;
      const ripple = document.createElement('div');
      ripple.className = 'hero-card__ripple';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${x - size/2}px;top:${y - size/2}px;`;
      hero.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }

    function openHeroDrawer(type: 'sips' | 'bites') {
      store.drawerType = type;
      store.drawerOpen = true;
    }

    // Apply hint-done class if already seen this session
    if (hintDone) {
      el.querySelectorAll('.hero-card').forEach(c => c.classList.add('hint-done'));
    }

    [sipsHero, bitesHero].forEach(hero => {
      if (!hero) return;
      const type: 'sips' | 'bites' = hero.id === 'hero-sips' ? 'sips' : 'bites';
      let startY = 0;
      let startX = 0;
      let dragging = false;

      // Click (desktop / tap that didn't become a swipe)
      hero.addEventListener('click', (e) => {
        spawnRipple(hero, e as MouseEvent);
        dismissHint(hero);
        openHeroDrawer(type);
      });

      hero.addEventListener('touchstart', (e: any) => {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        dragging = false;
        hero.classList.add('pressing');
        spawnRipple(hero, e.touches[0]);
      }, { passive: true });

      hero.addEventListener('touchmove', (e: any) => {
        const deltaY = e.touches[0].clientY - startY;
        const deltaX = Math.abs(e.touches[0].clientX - startX);
        // Only track upward swipes, not horizontal scrolls
        if (deltaY < -8 && deltaX < 30) {
          dragging = true;
          hero.classList.remove('pressing');
          hero.classList.add('swiping-up');
          // Live lift — card follows finger, capped at 28px
          const lift = Math.min(28, Math.abs(deltaY) * 0.55);
          hero.style.transform = `translateY(-${lift}px) scale(${1 + lift * 0.002})`;
        }
      }, { passive: true });

      hero.addEventListener('touchend', (e: any) => {
        const deltaY = e.changedTouches[0].clientY - startY;
        hero.classList.remove('pressing', 'swiping-up');
        hero.style.transform = '';
        if (deltaY < -30) {
          // Swipe up — open drawer
          dismissHint(hero);
          if (e.cancelable) e.preventDefault();
          openHeroDrawer(type);
        } else if (!dragging) {
          // Was a tap — click handler already fired, just clean up
          dismissHint(hero);
        }
        dragging = false;
      });

      hero.addEventListener('touchcancel', () => {
        hero.classList.remove('pressing', 'swiping-up');
        hero.style.transform = '';
        dragging = false;
      });
    });

    // Qty stepper buttons
    el.querySelectorAll('.qty-stepper__btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(10);
        const target = e.currentTarget as HTMLElement;
        const id = target.dataset.id!;
        const action = target.dataset.action!;
        if (action === 'inc') updateQty(id, 1);
        else updateQty(id, -1);
        // Pop the qty count
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
        if (order) {
          store.sideDrawerOrder = order;
        }
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
        // Reveal delete bg proportionally
        if (deleteBg) {
          deleteBg.style.opacity = String(Math.min(1, currentX / 80));
          // Wobble at threshold
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
          // Collapse animation before removing
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
