export interface OrderItemModifier {
  modifier_name: string;
  price_delta_inr: number;
}

export interface OrderItem {
  id: string;
  qty: number;
  unit_price_inr: number;
  line_total_inr: number;
  customer_note?: string;
  position: number;
  menu_items?: { name: string };
  order_item_modifiers?: OrderItemModifier[];
}

export interface Order {
  id: string;
  order_code: string;
  customer_id: string;
  source: string;
  state: 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotal_inr: number;
  total_inr: number;
  payment_mode: string;
  payment_status: string;
  customer_note?: string;
  dynamic_eta_factor: number;
  promised_eta_min: number;
  created_at: string;
  updated_at: string;
  customers?: { phone_e164: string; display_name?: string };
  order_items?: OrderItem[];
}

export interface Session {
  id: string;
  customer_id: string;
  state: string;
  last_activity_at: string;
  customers?: { phone_e164: string; display_name?: string };
}

export interface SystemSettings {
  digital_lane_paused: boolean;
  rush_threshold: number;
  eta_inflation_factor: number;
  rain_protocol_active: boolean;
}

export interface CurrentUser {
  email: string;
  role: string;
}
