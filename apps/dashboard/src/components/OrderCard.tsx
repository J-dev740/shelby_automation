import React from 'react';
import { Order, OrderItem } from '../types';

interface OrderCardProps {
  order: Order;
  compact?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  actionColor?: string;
  onClick: () => void;
}

export function OrderCard({ order, compact = false, onAction, actionLabel, actionColor, onClick }: OrderCardProps) {
  return (
    <div 
      onClick={onClick}
      className="group bg-zinc-950/50 border border-zinc-800/60 hover:border-amber-500/50 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 cursor-pointer transition-all hover:bg-zinc-900/50"
    >
      <div className="flex-1 min-w-0 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono font-bold text-zinc-200 text-xs md:text-sm">{order.order_code}</span>
          {order.payment_status !== 'paid' && (
            <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Unpaid</span>
          )}
        </div>
        
        {!compact && (
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-white truncate">{order.customers?.display_name || order.customers?.phone_e164}</p>
            <p className="text-[10px] md:text-xs text-zinc-400 truncate">
              {order.order_items?.map((i: OrderItem) => `${i.qty}x ${i.menu_items?.name}`).join(', ')}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
        <div className="text-right hidden md:block">
           <p className="text-xs font-mono text-zinc-400">{order.promised_eta_min}m ETA</p>
        </div>
        {actionLabel && actionColor && onAction && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(); }}
            className={`px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-bold text-xs shadow-md transition-transform active:scale-95 ${actionColor}`}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
