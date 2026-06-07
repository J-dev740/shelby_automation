import React, { useState, useEffect } from 'react';
import { Order, OrderItem } from '../types';
import { Clock } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  compact?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  actionColor?: string;
  onClick: () => void;
}

function useSlaTimer(order: Order) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const created = new Date(order.created_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - created) / 60000));
    tick();
    const id = setInterval(tick, 30000); // update every 30s
    return () => clearInterval(id);
  }, [order.created_at]);

  const etaMin = order.promised_eta_min || 15;
  const ratio = elapsed / etaMin;

  let color = 'text-emerald-400';
  let bg = 'bg-emerald-500/10 border-emerald-500/20';
  let label = 'On Track';

  if (ratio > 1) {
    color = 'text-red-400';
    bg = 'bg-red-500/10 border-red-500/20';
    label = 'Overdue';
  } else if (ratio > 0.75) {
    color = 'text-amber-400';
    bg = 'bg-amber-500/10 border-amber-500/20';
    label = 'Rush';
  }

  return { elapsed, etaMin, ratio, color, bg, label };
}

export function OrderCard({ order, compact = false, onAction, actionLabel, actionColor, onClick }: OrderCardProps) {
  const sla = useSlaTimer(order);
  const isNew = order.state === 'new';
  const isActive = ['new', 'accepted', 'preparing'].includes(order.state);

  return (
    <div 
      onClick={onClick}
      className={`group bg-zinc-950/50 border rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 cursor-pointer transition-all hover:bg-zinc-900/50 ${
        isNew 
          ? 'border-amber-500/40 shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)] animate-pulse-subtle' 
          : 'border-zinc-800/60 hover:border-amber-500/50'
      }`}
    >
      <div className="flex-1 min-w-0 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono font-bold text-zinc-200 text-xs md:text-sm">{order.order_code}</span>
          {order.payment_status !== 'paid' && (
            <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Unpaid</span>
          )}
          {order.source === 'pos' && (
            <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">POS</span>
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
        {/* SLA Timer Badge — only for active orders */}
        {isActive && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] md:text-xs font-mono ${sla.bg} ${sla.color}`}>
            <Clock className="h-3 w-3" />
            <span>{sla.elapsed}m / {sla.etaMin}m</span>
            {sla.ratio > 1 && <span className="font-bold uppercase ml-0.5 animate-pulse">!</span>}
          </div>
        )}

        {/* Completed/Cancelled state badge — for history */}
        {!isActive && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
            order.state === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>{order.state}</span>
        )}

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
