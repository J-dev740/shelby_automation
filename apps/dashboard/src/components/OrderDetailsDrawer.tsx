import React from 'react';
import { User, X } from 'lucide-react';
import { Order } from '../types';

interface OrderDetailsDrawerProps {
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  updateOrderStatus: (orderId: string, newState: Order['state']) => void;
  markOrderPaid: (orderId: string) => void;
}

export function OrderDetailsDrawer({
  selectedOrder,
  setSelectedOrder,
  updateOrderStatus,
  markOrderPaid
}: OrderDetailsDrawerProps) {
  if (!selectedOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:justify-end justify-center items-end md:items-stretch">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={() => setSelectedOrder(null)} 
      />
      
      {/* Drawer Panel */}
      <div className="relative w-full md:w-[450px] h-[90vh] md:h-full bg-zinc-950 border-t md:border-t-0 md:border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-bottom md:slide-in-from-right duration-300 rounded-t-3xl md:rounded-none">
        
        {/* Drawer Header */}
        <div className="p-5 md:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30 flex-shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-white tracking-tight">Order {selectedOrder.order_code}</h3>
              {selectedOrder.payment_status !== 'paid' && (
                <span className="bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-[10px] px-2 py-0.5 rounded-md uppercase">Unpaid</span>
              )}
            </div>
            <p className="text-sm text-zinc-400 flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              {selectedOrder.customers?.display_name || selectedOrder.customers?.phone_e164}
            </p>
          </div>
          <button onClick={() => setSelectedOrder(null)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
          {/* Order Items */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Items</h4>
            {selectedOrder.order_items?.map((item, idx) => (
              <div key={item.id || idx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-start justify-between font-medium text-white text-sm">
                  <div className="flex gap-2">
                    <span className="font-bold text-amber-500">{item.qty}x</span>
                    <span>{item.menu_items?.name}</span>
                  </div>
                  <span className="font-mono text-zinc-400">₹{item.line_total_inr}</span>
                </div>

                {item.order_item_modifiers && item.order_item_modifiers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {item.order_item_modifiers.map((mod, midx) => (
                      <span key={midx} className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded border border-zinc-700">
                        {mod.modifier_name} {mod.price_delta_inr > 0 ? `(+₹${mod.price_delta_inr})` : ''}
                      </span>
                    ))}
                  </div>
                )}
                
                {item.customer_note && (
                  <div className="ml-6 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-[11px] text-amber-300 italic">
                    &quot;{item.customer_note}&quot;
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Receipt Summary */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 space-y-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono">₹{selectedOrder.subtotal_inr}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400 items-center">
              <span>Payment ({selectedOrder.payment_mode})</span>
              <div className="flex items-center gap-2">
                <span className={selectedOrder.payment_status === 'paid' ? 'text-emerald-400' : 'text-red-400'}>
                  {selectedOrder.payment_status.toUpperCase()}
                </span>
                {selectedOrder.payment_status !== 'paid' && (
                  <button onClick={() => markOrderPaid(selectedOrder.id)} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded border border-zinc-700">
                    Mark Paid
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-zinc-800/80">
              <span>Total</span>
              <span className="font-mono text-amber-400">₹{selectedOrder.total_inr}</span>
            </div>
          </div>
        </div>

        {/* Drawer Footer (Fixed Primary Action) */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex-shrink-0">
           {selectedOrder.state === 'new' && (
             <DrawerActionButton label="Accept Order" color="bg-amber-500 hover:bg-amber-400 text-zinc-950" onClick={() => updateOrderStatus(selectedOrder.id, 'accepted')} />
           )}
           {selectedOrder.state === 'accepted' && (
             <DrawerActionButton label="Start Preparing" color="bg-blue-500 hover:bg-blue-400 text-white" onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')} />
           )}
           {selectedOrder.state === 'preparing' && (
             <DrawerActionButton label="Mark Ready for Pickup" color="bg-purple-500 hover:bg-purple-400 text-white" onClick={() => updateOrderStatus(selectedOrder.id, 'ready')} />
           )}
           {selectedOrder.state === 'ready' && (
             <DrawerActionButton label="Complete Order" color="bg-emerald-500 hover:bg-emerald-400 text-zinc-950" onClick={() => updateOrderStatus(selectedOrder.id, 'completed')} />
           )}
        </div>
      </div>
    </div>
  );
}

function DrawerActionButton({ label, color, onClick }: { label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full py-4 rounded-xl font-bold text-sm md:text-base shadow-lg transition-transform active:scale-[0.98] ${color}`}
    >
      {label}
    </button>
  );
}
