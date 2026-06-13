import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Order, OrderItem } from '../types';
import { X, Plus, Minus, Pencil, RefreshCw, Trash2, ChefHat, Save } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface MenuCategory {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
}

interface MenuItem {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  price_inr: number;
  prep_time_min: number;
  active: boolean;
}

interface EditCartItem {
  menuItem: MenuItem;
  qty: number;
  note: string;
  existingOrderItemId?: string; // if editing an existing line
}

interface EditOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function EditOrderModal({ order, isOpen, onClose, onOrderUpdated }: EditOrderModalProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<EditCartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Fetch menu + pre-populate cart ─────────────────────────────────────────

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('active', true).order('sort_order'),
      ]);

      const cats = catRes.data || [];
      const items = itemRes.data || [];
      setCategories(cats);
      setMenuItems(items);
      if (cats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(cats[0].id);
      }

      // Pre-populate cart from existing order items
      if (order.order_items && order.order_items.length > 0) {
        const cartItems: EditCartItem[] = order.order_items.map((oi: OrderItem) => {
          // Find the matching menu item from the fetched list
          const mi = items.find((m: MenuItem) => m.name === oi.menu_items?.name);
          return {
            menuItem: mi || {
              id: '',
              category_id: '',
              slug: oi.menu_items?.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
              name: oi.menu_items?.name || 'Unknown Item',
              price_inr: oi.unit_price_inr,
              prep_time_min: 5,
              active: true,
            },
            qty: oi.qty,
            note: oi.customer_note || '',
            existingOrderItemId: oi.id,
          };
        });
        setCart(cartItems);
      }
    } catch {
      console.error('Failed to initialize edit modal');
    } finally {
      setLoading(false);
    }
  }, [order, selectedCategoryId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      initialize();
    }
  }, [isOpen]);

  // ── Cart operations ────────────────────────────────────────────────────────

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c => c.menuItem.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { menuItem: item, qty: 1, note: '' }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart(prev => prev.map(c => c.menuItem.id === itemId ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  };

  const updateNote = (itemId: string, note: string) => {
    setCart(prev => prev.map(c => c.menuItem.id === itemId ? { ...c, note } : c));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.menuItem.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.menuItem.price_inr * c.qty, 0);
  const cartItemCount = cart.reduce((sum, c) => sum + c.qty, 0);
  const maxEta = cart.length > 0 ? Math.max(...cart.map(c => c.menuItem.prep_time_min)) : order.promised_eta_min;

  // ── Detect changes ─────────────────────────────────────────────────────────

  const hasChanges = (() => {
    if (!order.order_items) return cart.length > 0;
    if (cart.length !== order.order_items.length) return true;
    return cart.some((c, i) => {
      const orig = order.order_items?.[i];
      if (!orig) return true;
      return c.menuItem.name !== orig.menu_items?.name || c.qty !== orig.qty || c.note !== (orig.customer_note || '');
    });
  })();

  // ── Save Changes ───────────────────────────────────────────────────────────

  const saveChanges = async () => {
    if (cart.length === 0) {
      setError('Cannot save an order with no items. Cancel the order instead.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      // 1. Delete all existing order items (cascade will handle modifiers)
      const { error: deleteErr } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);
      if (deleteErr) throw new Error(`Failed to clear old items: ${deleteErr.message}`);

      // 2. Insert new order items
      const orderItems = cart.map((c, idx) => ({
        order_id: order.id,
        item_id: c.menuItem.id,
        qty: c.qty,
        unit_price_inr: c.menuItem.price_inr,
        line_total_inr: c.menuItem.price_inr * c.qty,
        customer_note: c.note || null,
        position: idx + 1,
      }));

      const { error: insertErr } = await supabase.from('order_items').insert(orderItems);
      if (insertErr) throw new Error(`Failed to insert updated items: ${insertErr.message}`);

      // 3. Update order totals + ETA
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          subtotal_inr: cartTotal,
          total_inr: cartTotal,
          promised_eta_min: maxEta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      if (updateErr) throw new Error(`Failed to update order totals: ${updateErr.message}`);

      // Success
      onOrderUpdated();
      onClose();
    } catch (err) {
      console.error('Edit order failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const filteredItems = selectedCategoryId
    ? menuItems.filter(i => i.category_id === selectedCategoryId)
    : menuItems;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-amber-400 shadow-sm">
              <Pencil className="h-4 w-4 text-zinc-950" />
            </div>
            <div>
              <h2 className="font-bold text-white text-lg tracking-tight">Edit Order {order.order_code}</h2>
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400">
                {order.customers?.display_name || order.customers?.phone_e164} · {order.state}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Menu Browser */}
          <div className="flex-1 flex flex-col border-r border-zinc-800 overflow-hidden">
            {/* Category Tabs */}
            <div className="flex gap-2 p-3 border-b border-zinc-800/80 overflow-x-auto flex-shrink-0">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedCategoryId === cat.id
                      ? 'bg-amber-500 text-zinc-950 shadow-md'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-6 w-6 text-amber-500 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredItems.map(item => {
                    const inCart = cart.find(c => c.menuItem.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={`relative text-left p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                          inCart
                            ? 'bg-amber-500/10 border-amber-500/30 shadow-sm shadow-amber-500/10'
                            : 'bg-zinc-900/50 border-zinc-800/60 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-white text-sm leading-tight">{item.name}</p>
                            <p className="text-xs text-zinc-400 mt-1 font-mono">₹{item.price_inr}</p>
                          </div>
                          <div className="flex-shrink-0 ml-2 p-1.5 rounded-lg bg-zinc-800 text-zinc-400">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        {inCart && (
                          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-zinc-950 text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
                            {inCart.qty}
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          <ChefHat className="h-3 w-3 text-zinc-600" />
                          <span className="text-[10px] text-zinc-600">{item.prep_time_min}m</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Updated Cart */}
          <div className="w-full md:w-80 flex flex-col bg-zinc-900/30 overflow-hidden">
            <div className="p-3 border-b border-zinc-800/80 flex-shrink-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Pencil className="h-3 w-3" /> Updated Items
              </h4>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2">
                  <Trash2 className="h-8 w-8" />
                  <p className="text-xs text-center">All items removed.<br/>Add items or cancel the order.</p>
                </div>
              ) : (
                cart.map(c => (
                  <div key={c.menuItem.id || c.existingOrderItemId} className="bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{c.menuItem.name}</p>
                        <p className="text-xs text-zinc-400 font-mono">₹{c.menuItem.price_inr} × {c.qty} = ₹{c.menuItem.price_inr * c.qty}</p>
                      </div>
                      <button onClick={() => removeFromCart(c.menuItem.id)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    
                    {/* Qty Stepper */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(c.menuItem.id, -1)} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-bold text-white w-8 text-center">{c.qty}</span>
                      <button onClick={() => updateQty(c.menuItem.id, 1)} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Note */}
                    <input
                      type="text"
                      placeholder="Add note..."
                      value={c.note}
                      onChange={e => updateNote(c.menuItem.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] text-white placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/30"
                    />
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex-shrink-0 space-y-3">
              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Diff Summary */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Original Total</span>
                  <span className="font-mono">₹{order.total_inr}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</span>
                  <span className={`font-bold font-mono ${cartTotal !== order.total_inr ? 'text-amber-400' : 'text-white'}`}>
                    ₹{cartTotal}
                    {cartTotal !== order.total_inr && (
                      <span className="text-[10px] ml-1">
                        ({cartTotal > order.total_inr ? '+' : ''}₹{cartTotal - order.total_inr})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={saveChanges}
                disabled={!hasChanges || saving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
