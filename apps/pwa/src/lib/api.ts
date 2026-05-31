const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.message || body.error || `HTTP ${res.status}`);
        (err as any).status = res.status;
        (err as any).body = body;
        throw err;
      }

      return await res.json();
    } catch (err: any) {
      lastError = err;
      // Don't retry client errors (4xx)
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
      // Wait before retry (exponential backoff)
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError!;
}

export const api = {
  async getMenu() {
    return request<{
      sips: any[];
      bites: any[];
      digital_lane_paused: boolean;
    }>('/api/menu');
  },

  async priceCart(lines: { itemId: string; qty: number; modifierIds: string[] }[]) {
    return request<any>('/api/cart/price', {
      method: 'POST',
      body: JSON.stringify({ lines }),
    });
  },

  async createOrder(data: {
    phone: string;
    lines: { itemId: string; qty: number; modifierIds: string[] }[];
    customerNote?: string;
    idempotencyKey: string;
  }) {
    return request<{
      orderId: string;
      orderCode: string;
      total: number;
      eta_min: number;
    }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getActiveOrders(phone: string) {
    return request<{ orders: any[] }>(`/api/orders/${encodeURIComponent(phone)}/active`);
  },
};
