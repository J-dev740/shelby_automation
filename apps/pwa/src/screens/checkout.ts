import { ICONS } from '../assets/icons.js';
import { store, clearCart, getCartTotal } from '../lib/store.js';
import { api } from '../lib/api.js';
import { save } from '../lib/persist.js';

let checkoutEl: HTMLElement | null = null;

export function openCheckout() {
  if (checkoutEl) return;
  if (store.cart.length === 0) return;

  checkoutEl = document.createElement('div');
  checkoutEl.className = 'checkout-overlay';
  checkoutEl.id = 'checkout';

  const savedPhone = store.phone ? store.phone.replace('+91', '') : '';
  const total = getCartTotal();

  checkoutEl.innerHTML = `
    <button class="checkout__back" id="checkout-back">${ICONS.chevronRight}</button>
    <h1 class="checkout__title">Almost there!</h1>
    <p class="checkout__subtitle">Enter your number — we'll call it when your order is ready</p>
    
    <div class="checkout__phone-group">
      <span class="checkout__prefix">+91</span>
      <input 
        class="checkout__phone-input" 
        id="phone-input"
        type="tel" 
        inputmode="numeric"
        pattern="[6-9][0-9]{9}"
        maxlength="10" 
        placeholder="98765 43210"
        value="${savedPhone}"
        autocomplete="tel-national"
      >
    </div>
    <div class="checkout__error" id="phone-error"></div>

    <div class="checkout__summary">
      <div class="checkout__summary-title">Order Summary</div>
      ${store.cart.map(item => `
        <div class="checkout__summary-item">
          <span>${item.qty}× ${item.name}</span>
          <span>₹${item.price_inr * item.qty}</span>
        </div>
      `).join('')}
      <div class="checkout__summary-total">
        <span>Total</span>
        <span>₹${total}</span>
      </div>
    </div>

    <button class="checkout__confirm-btn" id="confirm-btn">
      Pay at Counter · ₹${total}
    </button>
  `;

  document.body.appendChild(checkoutEl);

  // Auto-focus phone input
  const input = checkoutEl.querySelector('#phone-input') as HTMLInputElement;
  setTimeout(() => input?.focus(), 300);

  // Back button
  checkoutEl.querySelector('#checkout-back')?.addEventListener('click', closeCheckout);

  // Confirm button
  checkoutEl.querySelector('#confirm-btn')?.addEventListener('click', handleConfirm);

  // Phone validation on input
  input?.addEventListener('input', () => {
    const error = checkoutEl?.querySelector('#phone-error') as HTMLElement;
    if (error) error.textContent = '';
  });
}

async function handleConfirm() {
  const input = checkoutEl?.querySelector('#phone-input') as HTMLInputElement;
  const errorEl = checkoutEl?.querySelector('#phone-error') as HTMLElement;
  const confirmBtn = checkoutEl?.querySelector('#confirm-btn') as HTMLButtonElement;
  if (!input || !errorEl || !confirmBtn) return;

  const phone = input.value.trim();

  // Validate
  if (!/^[6-9]\d{9}$/.test(phone)) {
    errorEl.textContent = 'Enter a valid 10-digit mobile number';
    input.focus();
    return;
  }

  const fullPhone = `+91${phone}`;

  // Disable button + show loading
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Placing order...';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'checkout__loading';
  loadingEl.innerHTML = `<div class="checkout__spinner"></div><span style="color: var(--color-text-secondary);">Placing your order...</span>`;
  document.body.appendChild(loadingEl);

  try {
    // Generate idempotency key
    const cartHash = store.cart.map(i => `${i.itemId}:${i.qty}`).join('|');
    const idempotencyKey = `${phone}:${cartHash}:${Date.now()}`;

    const result = await api.createOrder({
      phone: fullPhone,
      lines: store.cart.map(item => ({
        itemId: item.itemId,
        qty: item.qty,
        modifierIds: [],
      })),
      idempotencyKey,
    });

    // Success!
    loadingEl.remove();
    store.phone = fullPhone;
    save('phone', fullPhone);
    window.dispatchEvent(new Event('phone-set'));

    clearCart();

    showSuccess(result.orderCode, result.total);
  } catch (err: any) {
    loadingEl.remove();
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Pay at Counter · ₹${getCartTotal()}`;

    if (err.body?.error === 'digital_lane_paused') {
      errorEl.textContent = '🍳 Kitchen is slammed — try again soon!';
    } else if (err.body?.error === 'Item unavailable') {
      errorEl.textContent = '⚠️ Some items became unavailable. Go back and check your cart.';
    } else {
      errorEl.textContent = 'Something went wrong. Please try again.';
    }
  }
}

function showSuccess(orderCode: string, total: number) {
  if (!checkoutEl) return;

  checkoutEl.innerHTML = `
    <div class="checkout__success">
      <div class="checkout__success-icon">${ICONS.check}</div>
      <div class="checkout__success-code">#${orderCode}</div>
      <p class="checkout__success-msg">
        Order placed! Pay ₹${total} at the counter.<br>
        We'll update your order status here.
      </p>
      <button class="btn btn-primary" id="success-done" style="margin-top: var(--space-xl); padding: var(--space-md) var(--space-2xl);">
        Done
      </button>
    </div>
  `;

  checkoutEl.querySelector('#success-done')?.addEventListener('click', () => {
    closeCheckout();
  });
}

export function closeCheckout() {
  if (!checkoutEl) return;
  checkoutEl.style.animation = 'fadeOut var(--duration-normal) var(--ease-out) forwards';
  checkoutEl.addEventListener('animationend', () => {
    checkoutEl?.remove();
    checkoutEl = null;
  }, { once: true });
}
